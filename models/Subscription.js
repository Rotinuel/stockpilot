import { SUBSCRIPTION_STATUSES } from "../lib/constants.js";
import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

// One document per subscription period/agreement (history). The tenant holds the current state.
const SubscriptionSchema = new Schema(
  {
    tenantId: tenantField,
    planId: { type: ObjectId, ref: "SubscriptionPlan", required: true },
    planCode: String,
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: "active" },
    amount: Number,
    currency: { type: String, default: "NGN" },
    interval: String,
    paystackSubscriptionCode: { type: String, index: true, sparse: true },
    paystackEmailToken: { type: String, select: false },
    paystackCustomerCode: String,
    paystackPlanCode: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    nextPaymentDate: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: Date,
    endedAt: Date,
    changeType: { type: String, enum: ["new", "upgrade", "downgrade", "renewal", "manual"], default: "new" },
    createdBy: { type: ObjectId, ref: "User" },
  },
  baseOptions,
);

SubscriptionSchema.index({ tenantId: 1, createdAt: -1 });
SubscriptionSchema.index({ status: 1 });

export default defineModel("Subscription", SubscriptionSchema);
