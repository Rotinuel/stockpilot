import { Schema, ObjectId, baseOptions, defineModel } from "./_helpers.js";

// One row per business that signed up with a referral link.
//   signed_up → rewarded (when the referred business makes its first payment) or void
const ReferralSchema = new Schema(
  {
    referrerTenantId: { type: ObjectId, ref: "Tenant", required: true, index: true },
    referredTenantId: { type: ObjectId, ref: "Tenant", required: true },
    code: { type: String, required: true },
    status: { type: String, enum: ["signed_up", "rewarded", "void"], default: "signed_up", index: true },
    signedUpAt: { type: Date, default: Date.now },

    // First successful payment by the referred business
    qualifiedAt: Date,
    paymentId: { type: ObjectId, ref: "Payment" },
    paymentAmount: Number,
    currency: { type: String, default: "NGN" },

    // Rewards (settings at the time of qualification)
    rewardDays: { type: Number, default: 0 },
    daysApplied: { type: String, enum: ["none", "trial", "subscription", "credit"], default: "none" },
    commissionPercent: { type: Number, default: 0 },
    commissionAmount: { type: Number, default: 0 },
    commissionStatus: { type: String, enum: ["none", "owed", "paid", "void"], default: "none", index: true },
    commissionPaidAt: Date,
    commissionPaidBy: { type: ObjectId, ref: "User" },
    payoutNote: { type: String, trim: true, maxlength: 300 },
    voidReason: { type: String, trim: true, maxlength: 300 },
  },
  baseOptions,
);

ReferralSchema.index({ referredTenantId: 1 }, { unique: true }); // a business can only be referred once
ReferralSchema.index({ referrerTenantId: 1, createdAt: -1 });
ReferralSchema.index({ createdAt: -1 });

export default defineModel("Referral", ReferralSchema);
