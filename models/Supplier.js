import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const SupplierSchema = new Schema(
  {
    tenantId: tenantField,
    name: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 32 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 1000 },
    balance: { type: Number, default: 0 }, // amount the business owes the supplier
    totalPurchases: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    purchaseCount: { type: Number, default: 0 },
    lastPurchaseAt: Date,
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: ObjectId, ref: "User" },
  },
  baseOptions,
);

SupplierSchema.index({ tenantId: 1, isDeleted: 1, name: 1 });
SupplierSchema.index({ tenantId: 1, balance: -1 });

export default defineModel("Supplier", SupplierSchema);
