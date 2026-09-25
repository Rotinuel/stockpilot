import { withApi } from "@/lib/api";
import { getManageLink } from "@/services/billing";

export const GET = withApi(async ({ ctx }) => getManageLink(ctx), { permission: "billing:manage" });
