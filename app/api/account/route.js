import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { accountSchema } from "@/lib/validators";
import { updateAccount } from "@/services/tenant";
import User from "@/models/User";
import { connectDB } from "@/lib/db";

// Works for tenant users and super admins alike (only touches the caller's own record).
export const GET = withApi(async ({ session }) => ({ user: session.user }), { anyUser: true });

export const PATCH = withApi(async ({ request, session }) => {
  const data = parse(accountSchema, await readJson(request));
  await connectDB();
  const user = await updateAccount({ userId: session.user._id }, data);
  return { user: await User.findById(user._id).select("name email phone avatar role").lean() };
}, { anyUser: true });
