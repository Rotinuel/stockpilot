import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { locationSchema } from "@/lib/validators";
import { listLocations, createLocation } from "@/services/locations";

export const GET = withApi(async ({ ctx }) => ({ items: await listLocations(ctx) }), { permission: "locations:view" });

export const POST = withApi(async ({ request, ctx }) => ({ location: await createLocation(ctx, parse(locationSchema, await readJson(request)), request) }), {
  permission: "locations:manage",
  write: true,
});
