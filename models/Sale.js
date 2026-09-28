import { PAYMENT_METHODS } from "../lib/constants.js";
import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const SaleSchema = new Schema(
  {
    tenantId: tenantField,
    invoiceNumber: { type: String, required: true },
    locationId: { type: ObjectId, ref: "Location" },
    customerId: { type: ObjectId, ref: "Customer", default: null },
    customerName: { type: String, default: "Walk-in customer" },
    itemCount: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    discountType: { type: String, enum: ["amount", "percent"], default: "amount" },
    discountValue: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    amountTendered: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    change: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    paymentStatus: { type: String, enum: ["paid", "partial", "unpaid"], default: "paid" },
    costOfGoods: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    cashierId: { type: ObjectId, ref: "User", required: true },
    cashierName: String,
    status: { type: String, enum: ["completed", "cancelled"], default: "completed" },
    notes: { type: String, trim: true, maxlength: 500 },
    cancelledAt: Date,
    cancelledBy: { type: ObjectId, ref: "User" },
    cancelReason: String,
    clientRequestId: { type: String }, // idempotency key from the POS (prevents double submission)
    source: { type: String, enum: ["pos", "offline"], default: "pos" },
    occurredAt: Date, // when an offline sale actually happened (createdAt is set to this too)
  },
  baseOptions,
);

SaleSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });
SaleSchema.index({ tenantId: 1, createdAt: -1 });
SaleSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
SaleSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
SaleSchema.index({ tenantId: 1, cashierId: 1, createdAt: -1 });
SaleSchema.index({ tenantId: 1, locationId: 1, createdAt: -1 });
SaleSchema.index({ tenantId: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });
SaleSchema.index({ tenantId: 1, balance: 1, customerId: 1 });

export default defineModel("Sale", SaleSchema);
