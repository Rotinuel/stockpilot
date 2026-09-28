// Minimal IndexedDB helper (browser only, no dependencies).
const DB_NAME = "stockpilot-offline";
const VERSION = 1;
let dbPromise = null;

function open() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const idb = {
  get: (store, key) => tx(store, "readonly", (s) => s.get(key)),
  put: (store, value) => tx(store, "readwrite", (s) => s.put(value)),
  delete: (store, key) => tx(store, "readwrite", (s) => s.delete(key)),
  all: (store) => tx(store, "readonly", (s) => s.getAll()),
  clear: (store) => tx(store, "readwrite", (s) => s.clear()),
};
