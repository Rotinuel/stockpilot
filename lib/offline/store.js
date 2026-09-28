// Offline data for the POS: catalogue snapshot + an outbox of sales recorded
// without a connection. Browser only. Everything is keyed by tenant + user so
// data from one account is never used by another.
import { idb } from "./idb.js";

export const OUTBOX_EVENT = "sp:outbox";

const catalogKey = (tenantId, locationId) => `catalog:${tenantId}:${locationId || "default"}`;

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}

export async function saveCatalog(tenantId, locationId, catalog) {
  try {
    await idb.put("kv", { key: catalogKey(tenantId, locationId), value: catalog, savedAt: Date.now() });
  } catch {}
}

export async function loadCatalog(tenantId, locationId) {
  try {
    const row = await idb.get("kv", catalogKey(tenantId, locationId));
    return row?.value || null;
  } catch {
    return null;
  }
}

/** Instant local search: exact barcode/SKU first, then name/sku/brand contains. */
export function searchCatalog(catalog, q, limit = 24) {
  const products = catalog?.products || [];
  const term = String(q || "").trim().toLowerCase();
  if (!term) return products.slice(0, limit).map((p) => ({ ...p, exact: false }));
  const exact = products.find((p) => p.barcode === term || p.sku.toLowerCase() === term);
  if (exact) return [{ ...exact, exact: true }];
  return products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)).slice(0, limit);
}

export async function applyLocalSale(tenantId, locationId, catalog, lines) {
  if (!catalog) return catalog;
  const byId = new Map(lines.map((l) => [l.productId, Number(l.quantity)]));
  const next = { ...catalog, products: catalog.products.map((p) => (byId.has(p.id) ? { ...p, quantity: Math.max(0, p.quantity - byId.get(p.id)) } : p)) };
  await saveCatalog(tenantId, locationId, next);
  return next;
}

export async function queueSale({ tenantId, userId, payload, preview }) {
  const item = { id: payload.clientRequestId, tenantId, userId, payload, preview, status: "pending", error: null, attempts: 0, createdAt: Date.now() };
  await idb.put("outbox", item);
  emit();
  return item;
}

export async function listOutbox(tenantId, userId) {
  try {
    const all = await idb.all("outbox");
    return all.filter((i) => i.tenantId === tenantId && i.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function updateOutbox(item) {
  await idb.put("outbox", item);
  emit();
}

export async function removeOutbox(id) {
  await idb.delete("outbox", id);
  emit();
}

/**
 * Push queued sales to the server. The server de-duplicates by clientRequestId,
 * so retrying after a dropped connection can never create a sale twice.
 */
export async function syncOutbox(tenantId, userId) {
  const items = await listOutbox(tenantId, userId);
  const result = { synced: 0, failed: 0, remaining: 0, offline: false };
  for (const item of items) {
    if (item.status === "failed") {
      result.failed++;
      continue;
    }
    let res;
    try {
      res = await fetch("/api/sales", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.payload) });
    } catch {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("sp:unreachable"));
      result.offline = true;
      result.remaining = items.length - result.synced - result.failed;
      break;
    }
    if (res.ok) {
      await idb.delete("outbox", item.id);
      result.synced++;
      continue;
    }
    if (res.status === 401) {
      result.remaining = items.length - result.synced - result.failed;
      break; // signed out — keep everything for later
    }
    const body = await res.json().catch(() => ({}));
    if (res.status >= 500 || res.status === 429) {
      result.remaining++;
      continue; // temporary problem, retry later
    }
    await idb.put("outbox", { ...item, status: "failed", attempts: item.attempts + 1, error: body?.error?.message || `Error ${res.status}` });
    result.failed++;
  }
  emit();
  return result;
}

export async function hasUnsyncedSales() {
  try {
    return (await idb.all("outbox")).length > 0;
  } catch {
    return false;
  }
}

/** Remove every offline copy (called on sign-out so the next user can't see it). */
export async function clearOfflineData() {
  try {
    await idb.clear("kv");
    await idb.clear("outbox");
  } catch {}
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("sp-pages")).map((k) => caches.delete(k)));
    }
  } catch {}
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sp:offline-ready:"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  emit();
}
