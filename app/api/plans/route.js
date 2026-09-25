import { withApi } from "@/lib/api";
import { getPublicPlans } from "@/services/plans";

// Public pricing data (no secrets: Paystack plan codes are omitted).
export const GET = withApi(
  async () => {
    const plans = await getPublicPlans();
    return {
      plans: plans.map(({ paystackPlanCode, __v, ...p }) => p),
    };
  },
  { auth: false },
);
