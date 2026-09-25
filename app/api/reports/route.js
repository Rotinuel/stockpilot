import { withApi } from "@/lib/api";
import { ApiError, badRequest, forbidden } from "@/lib/errors";
import { reportAccess } from "@/lib/report-access";
import { featureMessage } from "@/lib/plans";
import { rangeFromSearch, str } from "@/lib/query";
import { salesSummary, salesByDay, salesByPaymentMethod, topProducts, inventoryReport, profitReport, expensesSummary, customerReport } from "@/services/reports";

export const GET = withApi(
  async ({ ctx, session, searchParams }) => {
    const type = str(searchParams, "type") || "sales";
    const access = reportAccess(session.user.role, session.tenant.settings, session.plan, type);
    if (!access.allowed) {
      if (access.reason === "plan") throw new ApiError(403, featureMessage(access.feature), "PLAN_FEATURE");
      throw forbidden();
    }
    const range = rangeFromSearch(searchParams, ctx.timezone);
    const meta = { type, range: { from: range.from, to: range.to, label: range.label, preset: range.preset } };
    switch (type) {
      case "sales": {
        const [summary, daily, methods, top] = await Promise.all([salesSummary(ctx, range), salesByDay(ctx, range), salesByPaymentMethod(ctx, range), topProducts(ctx, range, 10)]);
        return { ...meta, summary, daily, methods, topProducts: top };
      }
      case "inventory":
        return { ...meta, ...(await inventoryReport(ctx)) };
      case "profit":
        return { ...meta, ...(await profitReport(ctx, range)) };
      case "expenses":
        return { ...meta, ...(await expensesSummary(ctx, range)) };
      case "customers":
        return { ...meta, ...(await customerReport(ctx, range)) };
      default:
        throw badRequest("Unknown report type.");
    }
  },
  { permission: "reports:view" },
);
