import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

// Per-location stock. Product.quantity is the sum across locations.
const ProductStockSchema = new Schema(
  {
    tenantId: tenantField,
    productId: { type: ObjectId, ref: "Product", required: true },
    locationId: { type: ObjectId, ref: "Location", required: true },
    quantity: { type: Number, default: 0 },
  },
  baseOptions,
);

ProductStockSchema.index({ tenantId: 1, productId: 1, locationId: 1 }, { unique: true });
ProductStockSchema.index({ tenantId: 1, locationId: 1 });

export default defineModel("ProductStock", ProductStockSchema);
