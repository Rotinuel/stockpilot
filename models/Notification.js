import { NOTIFICATION_TYPES } from "../lib/constants.js";
import { Schema, ObjectId, defineModel } from "./_helpers.js";

const NotificationSchema = new Schema(
  {
    // null tenantId = platform notification for super admins
    tenantId: { type: ObjectId, ref: "Tenant", default: null, index: true },
    userId: { type: ObjectId, ref: "User", default: null }, // targeted user (optional)
    roles: { type: [String], default: [] }, // restrict to roles (empty = everyone in tenant)
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system" },
    severity: { type: String, enum: ["info", "success", "warning", "danger"], default: "info" },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, maxlength: 1000 },
    link: String,
    readBy: { type: [ObjectId], default: [] },
    dedupeKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

NotificationSchema.index({ tenantId: 1, createdAt: -1 });
NotificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export default defineModel("Notification", NotificationSchema);
