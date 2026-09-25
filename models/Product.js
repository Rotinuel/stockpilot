import { UNITS, PRODUCT_STATUSES } from "../lib/constants.js";
import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const ProductSchema = new Schema(
  {
    tenantId: tenantField,
    name: { type: String, required: true, trim: true, maxlength: 160 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    barcode: { type: String, trim: true, maxlength: 64 },
    categoryId: { type: ObjectId, ref: "Category", default: null },
    brand: { type: String, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000 },
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    // Total quantity across all locations (denormalised from ProductStock for fast queries).
    quantity: { type: Number, default: 0 },
    minimumStockLevel: { type: Number, default: 0, min: 0 },
    unit: { type: String, enum: UNITS, default: "piece" },
    supplierId: { type: ObjectId, ref: "Supplier", default: null },
    image: { type: String, default: "" },
    status: { type: String, enum: PRODUCT_STATUSES, default: "active" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    createdBy: { type: ObjectId, ref: "User" },
  },
  baseOptions,
);

// Tenant-scoped uniqueness (deleted products release their SKU/barcode).
ProductSchema.index(
  { tenantId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
ProductSchema.index(
  { tenantId: 1, barcode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false, barcode: { $type: "string" } } },
);
ProductSchema.index({ tenantId: 1, isDeleted: 1, name: 1 });
ProductSchema.index({ tenantId: 1, isDeleted: 1, categoryId: 1 });
ProductSchema.index({ tenantId: 1, isDeleted: 1, quantity: 1 });
ProductSchema.index({ tenantId: 1, isDeleted: 1, createdAt: -1 });
ProductSchema.index({ tenantId: 1, supplierId: 1 });

ProductSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.minimumStockLevel;
});

export default defineModel("Product", ProductSchema);
