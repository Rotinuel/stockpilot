import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../lib/constants.js";
import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const ExpenseSchema = new Schema(
  {
    tenantId: tenantField,
    locationId: { type: ObjectId, ref: "Location" },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    description: { type: String, trim: true, maxlength: 300 },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    date: { type: Date, required: true, default: Date.now },
    reference: { type: String, trim: true, maxlength: 64 },
    createdBy: { type: ObjectId, ref: "User" },
    createdByName: String,
  },
  baseOptions,
);

ExpenseSchema.index({ tenantId: 1, date: -1 });
ExpenseSchema.index({ tenantId: 1, category: 1, date: -1 });

export default defineModel("Expense", ExpenseSchema);
