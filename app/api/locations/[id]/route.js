import { withApi, parse } from "@/lib/api";
import { readJson } from "@/lib/request";
import { locationSchema } from "@/lib/validators";
import { updateLocation, deleteLocation } from "@/services/locations";

export const PATCH = withApi(
  async ({ request, ctx, params }) => ({ location: await updateLocation(ctx, params.id, parse(locationSchema.partial(), await readJson(request)), request) }),
  { permission: "locations:manage", write: true },
);

export const DELETE = withApi(async ({ request, ctx, params }) => deleteLocation(ctx, params.id, request), { permission: "locations:manage", write: true });
