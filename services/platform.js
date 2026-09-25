import { connectDB } from "../lib/db.js";
import PlatformSetting from "../models/PlatformSetting.js";
import { DEFAULT_GRACE_DAYS } from "../lib/constants.js";

const TTL_MS = 30_000;
let cache = { at: 0, value: null };

const DEFAULTS = {
  key: "global",
  gracePeriodDays: DEFAULT_GRACE_DAYS,
  allowRegistrations: true,
  supportEmail: "support@stockpilot.ng",
  supportPhone: "",
  defaultCurrency: "NGN",
  announcement: { active: false, message: "", level: "info" },
  maintenanceMode: false,
};

export async function getPlatformSettings() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    await connectDB();
    const doc = await PlatformSetting.findOne({ key: "global" }).lean();
    cache = { at: Date.now(), value: { ...DEFAULTS, ...(doc || {}) } };
  } catch (err) {
    console.error("[platform] settings unavailable", err?.message);
    cache = { at: Date.now(), value: DEFAULTS };
  }
  return cache.value;
}

export async function updatePlatformSettings(patch) {
  await connectDB();
  const doc = await PlatformSetting.findOneAndUpdate({ key: "global" }, { $set: patch }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  cache = { at: 0, value: null };
  return doc;
}
