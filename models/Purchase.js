import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const PurchaseSchema = new Schema(
  {
    tenantId: tenantField,
    referenceNumber: { type: String, required: true }, // internal PO number
    invoiceNumber: { type: String, trim: true, maxlength: 64 }, // supplier's invoice number
    locationId: { type: ObjectId, ref: "Location" },
    supplierId: { type: ObjectId, ref: "Supplier", default: null },
    supplierName: String,
    itemCount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    total: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["paid", "partial", "unpaid"], default: "paid" },
    paymentMethod: { type: String, default: "cash" },
    purchaseDate: { type: Date, default: Date.now },
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ["completed", "cancelled"], default: "completed" },
    createdBy: { type: ObjectId, ref: "User" },
    createdByName: String,
    cancelledAt: Date,
    cancelledBy: { type: ObjectId, ref: "User" },
  },
  baseOptions,
);

PurchaseSchema.index({ tenantId: 1, referenceNumber: 1 }, { unique: true });
PurchaseSchema.index({ tenantId: 1, purchaseDate: -1 });
PurchaseSchema.index({ tenantId: 1, supplierId: 1, purchaseDate: -1 });
PurchaseSchema.index({ tenantId: 1, invoiceNumber: 1 });

export default defineModel("Purchase", PurchaseSchema);
