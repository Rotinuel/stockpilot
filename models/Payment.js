import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

// Subscription payments made by tenants to the platform (via Paystack).
const PaymentSchema = new Schema(
  {
    tenantId: tenantField,
    subscriptionId: { type: ObjectId, ref: "Subscription" },
    planId: { type: ObjectId, ref: "SubscriptionPlan" },
    planCode: String,
    reference: { type: String, required: true },
    amount: { type: Number, required: true }, // major units
    currency: { type: String, default: "NGN" },
    status: { type: String, enum: ["pending", "success", "failed", "abandoned", "reversed"], default: "pending", index: true },
    purpose: { type: String, enum: ["subscription", "renewal", "upgrade", "downgrade"], default: "subscription" },
    channel: String,
    gatewayResponse: String,
    failureReason: String,
    paystackTransactionId: String,
    paystackInvoiceCode: String,
    paidAt: Date,
    verifiedAt: Date,
    verifiedVia: { type: String, enum: ["callback", "webhook", "cron", "admin", null], default: null },
    initiatedBy: { type: ObjectId, ref: "User" },
    customerEmail: String,
    cardLast4: String,
    cardBrand: String,
  },
  baseOptions,
);

PaymentSchema.index({ reference: 1 }, { unique: true });
PaymentSchema.index({ tenantId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

export default defineModel("Payment", PaymentSchema);
