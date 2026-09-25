import { Schema, ObjectId, baseOptions, defineModel, tenantField } from "./_helpers.js";

const LocationSchema = new Schema(
  {
    tenantId: tenantField,
    name: { type: String, required: true, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 300 },
    phone: { type: String, trim: true },
    managerId: { type: ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  baseOptions,
);

LocationSchema.index({ tenantId: 1, name: 1 }, { unique: true });
LocationSchema.index({ tenantId: 1, isDefault: 1 });

export default defineModel("Location", LocationSchema);
