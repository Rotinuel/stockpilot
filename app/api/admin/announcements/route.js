import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { announcementSchema } from "@/lib/validators";
import { broadcastAnnouncement } from "@/services/notifications";
import { logAudit } from "@/services/audit";

export const POST = withApi(
  async ({ request, session }) => {
    const data = parse(announcementSchema, await readJson(request));
    const result = await broadcastAnnouncement(data);
    await logAudit({ userId: session.user._id, userName: session.user.name, role: "super_admin" }, "platform.announcement", { tenantId: null, metadata: { title: data.title, sent: result.sent }, request });
    return result;
  },
  { superAdmin: true },
);
