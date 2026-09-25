import { withApi } from "@/lib/api";
import { dashboardData } from "@/services/reports";

export const GET = withApi(async ({ ctx }) => dashboardData(ctx), { permission: "dashboard:financials" });
