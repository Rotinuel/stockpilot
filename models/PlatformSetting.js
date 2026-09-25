import { Schema, baseOptions, defineModel } from "./_helpers.js";

const PlatformSettingSchema = new Schema(
  {
    key: { type: String, default: "global" },
    gracePeriodDays: { type: Number, default: 3, min: 0, max: 30 },
    allowRegistrations: { type: Boolean, default: true },
    supportEmail: { type: String, default: "support@stockpilot.ng" },
    supportPhone: { type: String, default: "" },
    defaultCurrency: { type: String, default: "NGN" },
    announcement: {
      active: { type: Boolean, default: false },
      message: { type: String, default: "" },
      level: { type: String, enum: ["info", "warning", "success"], default: "info" },
    },
    maintenanceMode: { type: Boolean, default: false },
  },
  baseOptions,
);

PlatformSettingSchema.index({ key: 1 }, { unique: true });

export default defineModel("PlatformSetting", PlatformSettingSchema);
