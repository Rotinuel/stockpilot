import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { onboardingStepSchema } from "@/lib/validators";
import { saveOnboardingStep, completeOnboarding } from "@/services/tenant";

export const PATCH = withApi(
  async ({ request, ctx }) => {
    const { step, data } = parse(onboardingStepSchema, await readJson(request));
    return saveOnboardingStep(ctx, step, data || {}, request);
  },
  { permission: "settings:business" },
);

export const POST = withApi(async ({ request, ctx }) => completeOnboarding(ctx, request), { permission: "settings:business" });
