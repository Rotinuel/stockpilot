import { withApi } from "@/lib/api";
import Payment from "@/models/Payment";
import { pageParams } from "@/lib/query";

export const GET = withApi(
  async ({ ctx, searchParams }) => {
    const { page, limit } = pageParams(searchParams);
    const filter = { tenantId: ctx.tenantId };
    const [items, total] = await Promise.all([
      Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Payment.countDocuments(filter),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
  },
  { permission: "billing:view" },
);
