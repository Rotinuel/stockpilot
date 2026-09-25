import { Schema, ObjectId, defineModel } from "./_helpers.js";

const AuditLogSchema = new Schema(
  {
    tenantId: { type: ObjectId, ref: "Tenant", default: null }, // null = platform-level action
    userId: { type: ObjectId, ref: "User", default: null },
    userName: String,
    userRole: String,
    action: { type: String, required: true }, // e.g. product.create
    entity: String, // e.g. Product
    entityId: { type: ObjectId },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ tenantId: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

export default defineModel("AuditLog", AuditLogSchema);
