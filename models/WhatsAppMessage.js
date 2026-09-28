import { Schema, ObjectId, defineModel } from "./_helpers.js";

// Delivery log for outgoing WhatsApp notifications.
const WhatsAppMessageSchema = new Schema(
  {
    tenantId: { type: ObjectId, ref: "Tenant", index: true, default: null },
    to: { type: String, required: true },
    template: String,
    notificationType: String,
    params: { type: [String], default: [] },
    status: { type: String, enum: ["sent", "logged", "failed", "skipped"], default: "sent" },
    providerMessageId: String,
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

WhatsAppMessageSchema.index({ tenantId: 1, createdAt: -1 });
WhatsAppMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default defineModel("WhatsAppMessage", WhatsAppMessageSchema);
