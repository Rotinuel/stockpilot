import { Schema, ObjectId, defineModel, tenantField } from "./_helpers.js";

const PurchaseItemSchema = new Schema(
  {
    tenantId: tenantField,
    purchaseId: { type: ObjectId, ref: "Purchase", required: true },
    productId: { type: ObjectId, ref: "Product", required: true },
    name: String,
    sku: String,
    unit: String,
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

PurchaseItemSchema.index({ tenantId: 1, purchaseId: 1 });
PurchaseItemSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });

export default defineModel("PurchaseItem", PurchaseItemSchema);
