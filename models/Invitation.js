import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const InvitationSchema = new Schema(
  {
    tenantId: tenantField,
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    role: { type: String, enum: ["admin", "manager", "cashier", "inventory_staff"], required: true },
    locationId: { type: ObjectId, ref: "Location" },
    tokenHash: { type: String, required: true, select: false },
    invitedBy: { type: ObjectId, ref: "User" },
    invitedByName: String,
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    expiresAt: { type: Date, required: true },
    acceptedAt: Date,
  },
  baseOptions,
);

InvitationSchema.index({ tenantId: 1, email: 1, status: 1 });
InvitationSchema.index({ tokenHash: 1 });

export default defineModel("Invitation", InvitationSchema);
