import { withApi } from "@/lib/api";
import { ApiError, forbidden } from "@/lib/errors";
import { reportAccess } from "@/lib/report-access";
import { featureMessage, hasFeature } from "@/lib/plans";
import { rangeFromSearch, str } from "@/lib/query";
import { buildReport, reportToCSV, reportToPDF } from "@/services/export";
import { logAudit } from "@/services/audit";

export const GET = withApi(
  async ({ request, ctx, session, searchParams }) => {
    const type = str(searchParams, "type") || "sales";
    const format = str(searchParams, "format") === "pdf" ? "pdf" : "csv";
    const access = reportAccess(session.user.role, session.tenant.settings, session.plan, type);
    if (!access.allowed) {
      if (access.reason === "plan") throw new ApiError(403, featureMessage(access.feature), "PLAN_FEATURE");
      throw forbidden();
    }
    if (!hasFeature(session.plan, "export")) throw new ApiError(403, featureMessage("export"), "PLAN_FEATURE");

    const range = rangeFromSearch(searchParams, ctx.timezone);
    const report = await buildReport(ctx, type, range);
    const stamp = new Date().toISOString().slice(0, 10);
    await logAudit(ctx, "report.export", { entity: "Report", metadata: { type, format, range: range.label }, request });

    if (format === "pdf") {
      const bytes = await reportToPDF(ctx, report, range.label);
      return new Response(bytes, {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${type}-report-${stamp}.pdf"`, "Cache-Control": "no-store" },
      });
    }
    return new Response(`﻿${reportToCSV(report)}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-report-${stamp}.csv"`, "Cache-Control": "no-store" },
    });
  },
  { permission: "reports:view" },
);
