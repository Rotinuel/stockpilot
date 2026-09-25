import { PAYMENT_METHODS } from "../lib/constants.js";
import { Schema, ObjectId, defineModel, tenantField } from "./_helpers.js";

// Payment history for customer debts (money in) and supplier debts (money out).
const BalancePaymentSchema = new Schema(
  {
    tenantId: tenantField,
    partyType: { type: String, enum: ["customer", "supplier"], required: true },
    partyId: { type: ObjectId, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    method: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    note: { type: String, trim: true, maxlength: 300 },
    // What the payment was applied to (FIFO against outstanding invoices)
    allocations: [
      {
        referenceType: { type: String, enum: ["Sale", "Purchase"] },
        referenceId: ObjectId,
        referenceNumber: String,
        amount: Number,
      },
    ],
    balanceBefore: Number,
    balanceAfter: Number,
    recordedBy: { type: ObjectId, ref: "User" },
    recordedByName: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

BalancePaymentSchema.index({ tenantId: 1, partyType: 1, partyId: 1, createdAt: -1 });

export default defineModel("BalancePayment", BalancePaymentSchema);
