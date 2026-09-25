import { withApi } from "@/lib/api";
import { readJson } from "@/lib/request";
import { markNotificationsRead } from "@/services/notifications";

export const POST = withApi(async ({ request, ctx }) => {
  const body = await readJson(request);
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)).slice(0, 100) : [];
  return markNotificationsRead(ctx, ids);
});
