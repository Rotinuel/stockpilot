import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const CustomerSchema = new Schema(
  {
    tenantId: tenantField,
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 32 },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300 },
    type: { type: String, enum: ["cash", "credit"], default: "cash" },
    creditLimit: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 }, // amount the customer owes the business
    totalPurchases: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    purchaseCount: { type: Number, default: 0 },
    lastPurchaseAt: Date,
    notes: { type: String, trim: true, maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: ObjectId, ref: "User" },
  },
  baseOptions,
);

CustomerSchema.index({ tenantId: 1, isDeleted: 1, name: 1 });
CustomerSchema.index({ tenantId: 1, phone: 1 });
CustomerSchema.index({ tenantId: 1, balance: -1 });

export default defineModel("Customer", CustomerSchema);
