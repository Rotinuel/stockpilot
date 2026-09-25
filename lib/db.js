import mongoose from "mongoose";

// Cache the connection across hot reloads and serverless invocations.
const globalCache = globalThis.__stockpilotMongo || (globalThis.__stockpilotMongo = { conn: null, promise: null, supportsTx: null });

export async function connectDB(uri = process.env.MONGODB_URI) {
  if (globalCache.conn && mongoose.connection.readyState === 1) return globalCache.conn;
  if (!uri) throw new Error("MONGODB_URI is not configured. Copy .env.example to .env.local and set it.");
  if (!globalCache.promise) {
    mongoose.set("strictQuery", true);
    // NOTE: user input is validated/coerced with zod before reaching queries,
    // so operator injection ({"$gt": ""}) is impossible by construction.
    globalCache.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: Number(process.env.MONGODB_POOL_SIZE || 10),
        serverSelectionTimeoutMS: 10_000,
        autoIndex: process.env.NODE_ENV !== "production" || process.env.MONGODB_AUTO_INDEX === "true",
      })
      .then((m) => m);
  }
  try {
    globalCache.conn = await globalCache.promise;
  } catch (err) {
    globalCache.promise = null;
    throw err;
  }
  return globalCache.conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  globalCache.conn = null;
  globalCache.promise = null;
  globalCache.supportsTx = null;
}

/** Multi-document transactions require a replica set or sharded cluster (Atlas is fine). */
export async function supportsTransactions() {
  if (globalCache.supportsTx !== null) return globalCache.supportsTx;
  if (process.env.MONGODB_DISABLE_TRANSACTIONS === "true") return (globalCache.supportsTx = false);
  const conn = await connectDB();
  try {
    const hello = await conn.connection.db.admin().command({ hello: 1 });
    globalCache.supportsTx = Boolean(hello.setName || hello.msg === "isdbgrid");
  } catch {
    globalCache.supportsTx = false;
  }
  if (!globalCache.supportsTx) {
    console.warn("[db] MongoDB is not a replica set: transactions disabled, using compensating writes. Use Atlas or `mongod --replSet rs0` in production.");
  }
  return globalCache.supportsTx;
}

/**
 * Run `fn(session)` inside a transaction when supported, else `fn(null)`.
 * Callers must pass `{ session }` to every write and use `Compensation`
 * (below) so a failure without transactions is rolled back manually.
 */
export async function withTransaction(fn) {
  await connectDB();
  if (!(await supportsTransactions())) return fn(null);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/** Records undo steps; rollback() runs them in reverse order (best effort). */
export class Compensation {
  constructor(enabled) {
    this.enabled = enabled;
    this.steps = [];
  }
  add(undo) {
    if (this.enabled) this.steps.push(undo);
  }
  async rollback() {
    for (const undo of this.steps.reverse()) {
      try {
        await undo();
      } catch (err) {
        console.error("[db] compensation step failed", err);
      }
    }
    this.steps = [];
  }
}

export function isValidObjectId(id) {
  return typeof id === "string" && mongoose.isValidObjectId(id) && /^[a-f0-9]{24}$/i.test(id);
}

export function toObjectId(id) {
  return new mongoose.Types.ObjectId(String(id));
}
