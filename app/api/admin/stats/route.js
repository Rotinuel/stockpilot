import { withApi } from "@/lib/api";
import { platformStats } from "@/services/admin";

export const GET = withApi(async () => platformStats(), { superAdmin: true });
