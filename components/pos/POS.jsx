"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ScanBarcode, Minus, Plus, Trash2, UserRound, UserPlus, X, ShoppingCart, Printer, CircleCheck, Banknote, CreditCard, Smartphone, Landmark, Ellipsis, LoaderCircle, ImageOff, WifiOff, CloudUpload, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import Receipt from "@/components/sales/Receipt";
import WhatsAppReceiptButton from "@/components/sales/WhatsAppReceiptButton";
import { apiFetch, useAction } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/components/ui/Toast";
import { computeCartTotals, formatMoney, settlePayment } from "@/lib/money";
import { cn } from "@/utils/cn";
import { useOnline } from "@/components/offline/OfflineManager";
import { OUTBOX_EVENT, applyLocalSale, listOutbox, loadCatalog, queueSale, removeOutbox, saveCatalog, searchCatalog, syncOutbox, updateOutbox } from "@/lib/offline/store";

const METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "pos", label: "POS", icon: Smartphone },
  { value: "bank_transfer", label: "Transfer", icon: Landmark },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "other", label: "Other", icon: Ellipsis },
];

function newRequestId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function POS({ initialProducts, currency, taxRate, taxLabel, locations, defaultLocationId, allowCredit, tenantId, userId, cashierName }) {
  const toast = useToast();
  const searchRef = useRef(null);
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 200);
  const [results, setResults] = useState(initialProducts);
  const [searching, setSearching] = useState(false);
  const [locationId, setLocationId] = useState(defaultLocationId || locations[0]?._id || "");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [method, setMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [customerModal, setCustomerModal] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [mobileCart, setMobileCart] = useState(false);
  const requestId = useRef(newRequestId());

  const online = useOnline();
  const [catalog, setCatalog] = useState(null);
  const catalogRef = useRef(null);
  catalogRef.current = catalog;

  // Offline catalogue: load the saved copy instantly, then refresh from the server when online.
  const refreshCatalog = useCallback(async () => {
    if (!tenantId) return;
    const cached = await loadCatalog(tenantId, locationId);
    if (cached) setCatalog(cached);
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const fresh = await apiFetch(`/api/pos/catalog?location=${locationId}`);
      await saveCatalog(tenantId, locationId, fresh);
      setCatalog(fresh);
    } catch {}
  }, [tenantId, locationId]);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  const search = useCallback(
    async (term) => {
      // Search the local catalogue first (instant, works offline).
      if (catalogRef.current) {
        const items = searchCatalog(catalogRef.current, term, 24);
        setResults(items);
        return items;
      }
      setSearching(true);
      try {
        const res = await apiFetch(`/api/products/lookup?q=${encodeURIComponent(term)}&location=${locationId}`);
        setResults(res.items);
        return res.items;
      } catch {
        return [];
      } finally {
        setSearching(false);
      }
    },
    [locationId],
  );

  useEffect(() => {
    search(debounced);
  }, [debounced, search, catalog]);

  const addToCart = useCallback(
    (p, qty = 1) => {
      setCart((c) => {
        const existing = c.find((l) => l.id === p.id);
        const nextQty = (existing?.quantity || 0) + qty;
        if (nextQty > p.quantity) {
          toast.warning("Not enough stock", `${p.name}: only ${p.quantity} ${p.unit} available.`);
          if (!existing && p.quantity <= 0) return c;
        }
        if (existing) return c.map((l) => (l.id === p.id ? { ...l, quantity: Math.min(nextQty, Math.max(p.quantity, l.quantity)) } : l));
        return [...c, { ...p, quantity: Math.min(qty, Math.max(p.quantity, 0)) || qty }];
      });
    },
    [toast],
  );

  const onSearchKey = async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const items = await search(term);
    const exact = items.find((i) => i.exact) || (items.length === 1 ? items[0] : null);
    if (exact) {
      addToCart({ ...exact, stock: exact.quantity });
      setQ("");
    }
  };

  const setQty = (id, quantity) => setCart((c) => c.map((l) => (l.id === id ? { ...l, quantity: Math.max(0, quantity) } : l)).filter((l) => l.quantity > 0 || l.id !== id || quantity > 0));
  const remove = (id) => setCart((c) => c.filter((l) => l.id !== id));

  const totals = useMemo(
    () => computeCartTotals(cart.map((l) => ({ quantity: l.quantity, unitPrice: l.price })), { discountType, discountValue: Number(discountValue) || 0, taxRate }),
    [cart, discountType, discountValue, taxRate],
  );
  const tenderedNum = tendered === "" ? totals.total : Number(tendered) || 0;
  const settlement = settlePayment(totals.total, tenderedNum);
  const needsCustomer = settlement.balance > 0 && !customer;

  const reset = () => {
    setCart([]);
    setCustomer(null);
    setDiscountValue("");
    setTendered("");
    setMethod("cash");
    requestId.current = newRequestId();
    setMobileCart(false);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const [saving, setSaving] = useState(false);

  const saveOffline = async (payload) => {
    const occurredAt = new Date().toISOString();
    const lines = cart.map((l) => ({ productId: l.id, quantity: l.quantity }));
    const preview = {
      invoiceNumber: `OFFLINE-${payload.clientRequestId.slice(0, 8).toUpperCase()}`,
      createdAt: occurredAt,
      cashierName,
      customerName: customer?.name || "Walk-in customer",
      subtotal: totals.subtotal,
      discountType,
      discountValue: Number(discountValue) || 0,
      discount: totals.discount,
      taxRate,
      tax: totals.tax,
      total: totals.total,
      amountTendered: tenderedNum,
      amountPaid: settlement.amountPaid,
      balance: settlement.balance,
      change: settlement.change,
      paymentMethod: method,
      status: "completed",
    };
    const items = cart.map((l) => ({ _id: l.id, productId: l.id, name: l.name, quantity: l.quantity, unitPrice: l.price, lineTotal: l.price * l.quantity }));
    await queueSale({ tenantId, userId, payload: { ...payload, occurredAt }, preview: { sale: preview, items, customer } });
    const next = await applyLocalSale(tenantId, locationId, catalogRef.current, lines);
    if (next) setCatalog(next);
    setReceipt({ sale: preview, items, business: catalogRef.current?.business, customer, offline: true });
    toast.info("Saved offline", "This sale will be sent automatically when you're back online.");
    reset();
  };

  const complete = async () => {
    if (!cart.length || saving) return;
    if (needsCustomer) return toast.warning("Customer required", "Select a customer to record an unpaid balance.");
    const payload = {
      items: cart.map((l) => ({ productId: l.id, quantity: l.quantity })),
      customerId: customer?._id || undefined,
      discountType,
      discountValue: Number(discountValue) || 0,
      paymentMethod: method,
      amountTendered: tenderedNum,
      locationId: locationId || undefined,
      clientRequestId: requestId.current,
    };
    setSaving(true);
    try {
      if (!online || !navigator.onLine) return await saveOffline(payload);
      // Don't leave the cashier waiting on a very slow connection: after 20s keep the sale
      // on this device instead (same clientRequestId, so it can never be recorded twice).
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20_000);
      let res;
      try {
        res = await apiFetch("/api/sales", { method: "POST", body: payload, signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      toast.success("Sale completed");
      const next = await applyLocalSale(tenantId, locationId, catalogRef.current, payload.items);
      if (next) setCatalog(next);
      setReceipt(res);
      reset();
      if (!catalogRef.current) search("");
    } catch (err) {
      // Connection dropped mid-request → keep the sale on this device (same clientRequestId, so no duplicates).
      if (err?.code === "NETWORK" || err?.name === "AbortError" || [502, 503, 504].includes(err?.status)) return await saveOffline(payload);
      toast.error(err?.code === "SUBSCRIPTION_REQUIRED" ? "Subscription required" : "Couldn't complete the sale", err?.message);
    } finally {
      setSaving(false);
    }
  };

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ShoppingCart className="h-4 w-4" /> Cart <span className="text-slate-400">({cart.length})</span>
        </h2>
        {cart.length ? (
          <button type="button" onClick={() => setCart([])} className="text-xs font-medium text-rose-600 hover:text-rose-700">
            Clear
          </button>
        ) : null}
      </div>

      <div className="border-b border-slate-100 px-4 py-3">
        {customer ? (
          <div className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="truncate font-medium text-brand-900">{customer.name}</span>
              {customer.balance > 0 ? <span className="text-xs text-rose-600">owes {formatMoney(customer.balance, currency)}</span> : null}
            </span>
            <button type="button" onClick={() => setCustomer(null)} className="rounded p-0.5 text-brand-400 hover:text-brand-700" aria-label="Remove customer">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setCustomerModal(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-2 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700">
            <UserPlus className="h-4 w-4" /> Add customer (optional)
          </button>
        )}
      </div>

      <ul className="scrollbar-thin min-h-24 flex-1 divide-y divide-slate-100 overflow-y-auto">
        {cart.length ? (
          cart.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{l.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatMoney(l.price, currency)} · {l.quantity > l.stock ? <span className="text-rose-600">only {l.stock} in stock</span> : `${l.stock ?? l.quantity} avail.`}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{formatMoney(l.price * l.quantity, currency)}</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => (l.quantity <= 1 ? remove(l.id) : setQty(l.id, l.quantity - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Decrease">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={l.quantity}
                  onChange={(e) => setQty(l.id, Number(e.target.value))}
                  className="h-8 w-16 rounded-lg border border-slate-200 text-center text-sm tabular-nums"
                  aria-label={`Quantity of ${l.name}`}
                />
                <button type="button" onClick={() => setQty(l.id, l.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50" aria-label="Increase">
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(l.id)} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${l.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))
        ) : (
          <li className="flex flex-col items-center justify-center px-6 py-10 text-center text-sm text-slate-500">
            <ScanBarcode className="mb-2 h-8 w-8 text-slate-300" />
            Scan a barcode or tap a product to add it.
          </li>
        )}
      </ul>

      <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4">
        <div className="flex gap-2">
          <Select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="w-24" aria-label="Discount type">
            <option value="amount">{currency}</option>
            <option value="percent">%</option>
          </Select>
          <Input type="number" min="0" step="any" placeholder="Discount" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} aria-label="Discount value" />
        </div>
        <div className="space-y-1 text-sm">
          <p className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(totals.subtotal, currency)}</span>
          </p>
          {totals.discount ? (
            <p className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span className="tabular-nums">−{formatMoney(totals.discount, currency)}</span>
            </p>
          ) : null}
          {taxRate ? (
            <p className="flex justify-between text-slate-600">
              <span>
                {taxLabel} ({taxRate}%)
              </span>
              <span className="tabular-nums">{formatMoney(totals.tax, currency)}</span>
            </p>
          ) : null}
          <p className="flex justify-between pt-1 text-lg font-bold text-slate-900">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(totals.total, currency)}</span>
          </p>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition",
                method === m.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
              aria-pressed={method === m.value}
            >
              <m.icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>
        <Field label="Amount received" hint={allowCredit ? "Less than the total records a balance on the customer's account." : undefined}>
          <Input type="number" min="0" step="any" inputMode="decimal" placeholder={String(totals.total)} value={tendered} onChange={(e) => setTendered(e.target.value)} />
        </Field>
        {settlement.change > 0 ? (
          <p className="flex justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            <span>Change</span>
            <span>{formatMoney(settlement.change, currency)}</span>
          </p>
        ) : null}
        {settlement.balance > 0 ? (
          <p className="flex justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            <span>Balance on credit</span>
            <span>{formatMoney(settlement.balance, currency)}</span>
          </p>
        ) : null}
        <Button size="lg" className="w-full" onClick={complete} loading={saving} disabled={!cart.length}>
          Complete sale · {formatMoney(totals.total, currency)}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <div className="min-w-0">
        {!online ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>You're offline.</strong> Keep selling — sales are saved on this device and sent automatically when the connection returns.
              {catalog?.generatedAt ? <span className="block text-xs text-slate-300">Stock levels as of {new Date(catalog.generatedAt).toLocaleString("en-GB", { timeStyle: "short", dateStyle: "medium" })}.</span> : null}
            </p>
          </div>
        ) : null}
        <OfflineQueue tenantId={tenantId} userId={userId} currency={currency} online={online} onSynced={refreshCatalog} />
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search or scan barcode / SKU, then press Enter"
              className="field-input h-12 pr-10 pl-9 text-base"
              aria-label="Search products"
            />
            {searching ? <LoaderCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" /> : null}
          </div>
          {locations.length > 1 ? (
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-12 sm:w-48" aria-label="Location">
              {locations.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addToCart({ ...p, stock: p.quantity })}
              disabled={p.quantity <= 0}
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-card transition hover:border-brand-300 hover:shadow-pop disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex h-20 items-center justify-center bg-slate-50">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <ImageOff className="h-5 w-5 text-slate-300" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-3">
                <p className="line-clamp-2 text-sm font-medium text-slate-900">{p.name}</p>
                <p className="mt-auto pt-2 text-sm font-semibold text-brand-700">{formatMoney(p.price, currency)}</p>
                <p className={cn("text-xs", p.quantity <= 0 ? "text-rose-600" : "text-slate-500")}>{p.quantity <= 0 ? "Out of stock" : `${p.quantity} ${p.unit} in stock`}</p>
              </div>
            </button>
          ))}
          {!results.length ? <p className="col-span-full py-10 text-center text-sm text-slate-500">No products found.</p> : null}
        </div>
      </div>

      <aside className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)]">{cartPanel}</aside>

      {/* Mobile checkout bar + sheet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 lg:hidden">
        <Button size="lg" className="w-full" onClick={() => setMobileCart(true)} icon={ShoppingCart}>
          View cart ({cart.length}) · {formatMoney(totals.total, currency)}
        </Button>
      </div>
      {mobileCart ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileCart(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[92vh] animate-slide-up overflow-y-auto rounded-t-2xl bg-white">
            <div className="flex justify-end px-3 pt-3">
              <button type="button" onClick={() => setMobileCart(false)} className="rounded-lg p-1.5 text-slate-500" aria-label="Close cart">
                <X className="h-5 w-5" />
              </button>
            </div>
            {cartPanel}
          </div>
        </div>
      ) : null}
      <div className="h-20 lg:hidden" />

      {customerModal ? <CustomerPicker online={online} offlineCustomers={catalog?.customers || []} onClose={() => setCustomerModal(false)} onPick={(c) => { setCustomer(c); setCustomerModal(false); }} /> : null}

      {receipt ? (
        <Modal
          open
          onClose={() => setReceipt(null)}
          title={
            <span className="flex items-center gap-2">
              {receipt.offline ? <CloudUpload className="h-5 w-5 text-amber-500" /> : <CircleCheck className="h-5 w-5 text-emerald-500" />}
              {receipt.offline ? "Saved offline — will sync automatically" : "Sale completed"}
            </span>
          }
          footer={
            <>
              <WhatsAppReceiptButton sale={receipt.sale} items={receipt.items} businessName={receipt.business?.businessName} currency={currency} phone={receipt.customer?.phone} />
              <Button variant="outline" icon={Printer} onClick={() => window.print()}>
                Print receipt
              </Button>
              <Button onClick={() => setReceipt(null)}>New sale</Button>
            </>
          }
        >
          <Receipt sale={receipt.sale} items={receipt.items} business={receipt.business} customer={receipt.customer} location={receipt.location} currency={currency} />
        </Modal>
      ) : null}
    </div>
  );
}

function CustomerPicker({ onClose, onPick, online = true, offlineCustomers = [] }) {
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 250);
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", type: "cash" });
  const { run, loading, errors } = useAction();

  useEffect(() => {
    if (!online) {
      const term = debounced.trim().toLowerCase();
      setItems(offlineCustomers.filter((c) => !term || c.name.toLowerCase().includes(term) || (c.phone || "").includes(term)).slice(0, 20));
      return undefined;
    }
    const ctrl = new AbortController();
    apiFetch(`/api/customers/search?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => setItems(r.items))
      .catch(() => {});
    return () => ctrl.abort();
  }, [debounced, online, offlineCustomers]);

  const create = async (e) => {
    e.preventDefault();
    const res = await run(() => apiFetch("/api/customers", { method: "POST", body: form }), { success: "Customer added" });
    if (res) onPick({ ...res.customer, _id: String(res.customer._id) });
  };

  return (
    <Modal open onClose={onClose} title={creating ? "New customer" : "Select customer"}>
      {creating ? (
        <form onSubmit={create} className="space-y-4">
          <Field label="Name" error={errors.name}>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="cash">Cash customer</option>
              <option value="credit">Credit customer</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Back
            </Button>
            <Button type="submit" loading={loading}>
              Save & select
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <Input autoFocus placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {items.map((c) => (
              <li key={String(c._id)}>
                <button type="button" onClick={() => onPick({ ...c, _id: String(c._id) })} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50">
                  <span>
                    <span className="block font-medium text-slate-900">{c.name}</span>
                    <span className="text-xs text-slate-500">{c.phone || "No phone"}</span>
                  </span>
                  {c.balance > 0 ? <span className="text-xs text-rose-600">owes {formatMoney(c.balance)}</span> : null}
                </button>
              </li>
            ))}
            {!items.length ? <li className="px-3 py-6 text-center text-sm text-slate-500">No customers found.</li> : null}
          </ul>
          {online ? (
            <Button variant="soft" icon={UserPlus} onClick={() => setCreating(true)} className="w-full">
              Add new customer
            </Button>
          ) : (
            <p className="text-center text-xs text-slate-500">New customers can be added when you're back online.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Sales recorded offline on this device, with retry / discard for failed ones. */
function OfflineQueue({ tenantId, userId, currency, online, onSynced }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setItems(tenantId ? await listOutbox(tenantId, userId) : []), [tenantId, userId]);
  useEffect(() => {
    load();
    window.addEventListener(OUTBOX_EVENT, load);
    return () => window.removeEventListener(OUTBOX_EVENT, load);
  }, [load]);

  if (!items.length) return null;
  const syncNow = async () => {
    setBusy(true);
    try {
      const r = await syncOutbox(tenantId, userId);
      if (r.synced) {
        toast.success(`${r.synced} sale${r.synced === 1 ? "" : "s"} synced`);
        onSynced?.();
      }
      if (r.offline) toast.warning("Still offline", "We'll keep trying automatically.");
    } finally {
      setBusy(false);
    }
  };
  const retry = async (item) => {
    await updateOutbox({ ...item, status: "pending", error: null });
    if (online) syncNow();
  };
  const discard = async (item) => {
    if (!window.confirm(`Discard offline sale ${item.preview?.sale?.invoiceNumber}? It will not be recorded.`)) return;
    await removeOutbox(item.id);
    onSynced?.();
  };

  return (
    <div id="offline-sales" className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <CloudUpload className="h-4 w-4" /> {items.length} sale{items.length === 1 ? "" : "s"} saved on this device
        </p>
        <Button size="sm" variant="outline" icon={RefreshCw} onClick={syncNow} loading={busy} disabled={!online}>
          Sync now
        </Button>
      </div>
      <ul className="mt-3 divide-y divide-amber-100 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0">
              <span className="font-medium text-slate-900">{i.preview?.sale?.invoiceNumber}</span>{" "}
              <span className="text-slate-500">· {formatMoney(i.preview?.sale?.total || 0, currency)} · {new Date(i.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              {i.status === "failed" ? <span className="block text-xs text-rose-600">{i.error}</span> : null}
            </span>
            {i.status === "failed" ? (
              <span className="flex gap-2">
                <Button size="xs" variant="outline" onClick={() => retry(i)}>
                  Retry
                </Button>
                <Button size="xs" variant="danger-outline" onClick={() => discard(i)}>
                  Discard
                </Button>
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-700">Waiting to sync</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
