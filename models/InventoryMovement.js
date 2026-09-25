import { MOVEMENT_TYPES } from "../lib/constants.js";
import { Schema, ObjectId, defineModel, tenantField } from "./_helpers.js";

// Immutable stock ledger. Every stock change writes exactly one movement per product/location.
const InventoryMovementSchema = new Schema(
  {
    tenantId: tenantField,
    productId: { type: ObjectId, ref: "Product", required: true },
    productName: String,
    locationId: { type: ObjectId, ref: "Location" },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true }, // signed: + in, - out
    previousQuantity: { type: Number, required: true }, // product total before
    newQuantity: { type: Number, required: true }, // product total after
    locationPreviousQuantity: Number,
    locationNewQuantity: Number,
    unitCost: Number,
    reason: { type: String, trim: true, maxlength: 300 },
    referenceId: { type: ObjectId },
    referenceType: { type: String, enum: ["Sale", "Purchase", "Transfer", "Adjustment", "Product", null], default: null },
    referenceNumber: String,
    performedBy: { type: ObjectId, ref: "User" },
    performedByName: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

InventoryMovementSchema.index({ tenantId: 1, createdAt: -1 });
InventoryMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });
InventoryMovementSchema.index({ tenantId: 1, type: 1, createdAt: -1 });
InventoryMovementSchema.index({ tenantId: 1, referenceId: 1 });

export default defineModel("InventoryMovement", InventoryMovementSchema);
