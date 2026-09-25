import { withApi } from "@/lib/api";
import { listNotifications } from "@/services/notifications";
import { str } from "@/lib/query";

export const GET = withApi(async ({ ctx, searchParams }) => listNotifications(ctx, { limit: Math.min(50, Number(str(searchParams, "limit") || 20)), unreadOnly: str(searchParams, "unread") === "1" }));
