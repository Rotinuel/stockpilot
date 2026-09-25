import { Schema, ObjectId, defineModel } from "./_helpers.js";

// Atomic per-tenant sequences (invoice numbers, PO numbers, SKUs).
const CounterSchema = new Schema(
  {
    tenantId: { type: ObjectId, ref: "Tenant", required: true },
    key: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

CounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export default defineModel("Counter", CounterSchema);
