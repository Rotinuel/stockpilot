import { Schema, baseOptions, defineModel } from "./_helpers.js";

// Idempotency log for Paystack webhooks (duplicate deliveries are ignored).
const WebhookEventSchema = new Schema(
  {
    provider: { type: String, default: "paystack" },
    eventKey: { type: String, required: true },
    event: String,
    status: { type: String, enum: ["processing", "processed", "failed", "ignored"], default: "processing" },
    error: String,
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant" },
    processedAt: Date,
  },
  baseOptions,
);

WebhookEventSchema.index({ eventKey: 1 }, { unique: true });
WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 120 });

export default defineModel("WebhookEvent", WebhookEventSchema);
