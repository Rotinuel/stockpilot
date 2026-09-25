import { Schema, ObjectId, defineModel, tenantField } from "./_helpers.js";

const SaleItemSchema = new Schema(
  {
    tenantId: tenantField,
    saleId: { type: ObjectId, ref: "Sale", required: true },
    productId: { type: ObjectId, ref: "Product", required: true },
    locationId: { type: ObjectId, ref: "Location" },
    name: String,
    sku: String,
    unit: String,
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
    lineCost: { type: Number, default: 0 },
    status: { type: String, enum: ["completed", "cancelled"], default: "completed" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

SaleItemSchema.index({ tenantId: 1, saleId: 1 });
SaleItemSchema.index({ tenantId: 1, status: 1, createdAt: -1, productId: 1 });
SaleItemSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });

export default defineModel("SaleItem", SaleItemSchema);
