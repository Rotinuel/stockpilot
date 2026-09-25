import Counter from "../models/Counter.js";
import { sessionOpts } from "./_scope.js";

export async function nextSequence(tenantId, key, session = null) {
  const doc = await Counter.findOneAndUpdate(
    { tenantId, key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true, ...sessionOpts(session) },
  ).lean();
  return doc.seq;
}

export function formatNumberRef(prefix, seq, pad = 6) {
  return `${prefix || ""}${prefix ? "-" : ""}${String(seq).padStart(pad, "0")}`;
}
