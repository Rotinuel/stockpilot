import { withApi } from "@/lib/api";
import { getBillingOverview } from "@/services/billing";

export const GET = withApi(async ({ ctx }) => getBillingOverview(ctx), { permission: "billing:view" });
