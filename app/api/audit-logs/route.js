import { withApi } from "@/lib/api";
import { listAuditLogs } from "@/services/audit";
import { pageParams, str } from "@/lib/query";
import { escapeRegex } from "@/utils/slug";

export const GET = withApi(
  async ({ ctx, searchParams }) => {
    const filter = { tenantId: ctx.tenantId };
    const action = str(searchParams, "action", 40);
    if (action) filter.action = { $regex: `^${escapeRegex(action)}` };
    return listAuditLogs(filter, pageParams(searchParams, 30));
  },
  { permission: "audit:view", feature: "auditLogs" },
);
