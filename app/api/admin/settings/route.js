import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { platformSettingsSchema } from "@/lib/validators";
import { getPlatformSettings, updatePlatformSettings } from "@/services/platform";
import { logAudit } from "@/services/audit";

export const GET = withApi(async () => ({ settings: await getPlatformSettings() }), { superAdmin: true });

export const PATCH = withApi(
  async ({ request, session }) => {
    const data = parse(platformSettingsSchema, await readJson(request));
    const settings = await updatePlatformSettings(data);
    await logAudit({ userId: session.user._id, userName: session.user.name, role: "super_admin" }, "platform.settings_update", { tenantId: null, metadata: { fields: Object.keys(data) }, request });
    return { settings };
  },
  { superAdmin: true },
);
