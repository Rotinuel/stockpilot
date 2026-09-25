// Typed API errors. Anything that is not an ApiError is reported to the
// client as a generic 500 — raw database errors are never exposed.

export class ApiError extends Error {
  constructor(status, message, code = "ERROR", details = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg = "Invalid request.", details) => new ApiError(400, msg, "BAD_REQUEST", details);
export const unauthorized = (msg = "Please sign in to continue.") => new ApiError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "You do not have permission to perform this action.", code = "FORBIDDEN") => new ApiError(403, msg, code);
export const notFound = (msg = "The requested item was not found.") => new ApiError(404, msg, "NOT_FOUND");
export const conflict = (msg = "This item already exists.", details) => new ApiError(409, msg, "CONFLICT", details);
export const validationError = (details, msg = "Please correct the highlighted fields.") => new ApiError(422, msg, "VALIDATION_ERROR", details);
export const paymentRequired = (msg = "An active subscription is required for this action.", code = "SUBSCRIPTION_REQUIRED") => new ApiError(402, msg, code);
export const planLimit = (msg, details) => new ApiError(403, msg, "PLAN_LIMIT", details);
export const tooManyRequests = (msg = "Too many requests. Please wait a moment and try again.") => new ApiError(429, msg, "RATE_LIMITED");
export const serviceUnavailable = (msg = "Service temporarily unavailable.") => new ApiError(503, msg, "UNAVAILABLE");

/** Convert Mongo/Mongoose/Zod errors into safe ApiErrors. */
export function normalizeError(err) {
  if (err instanceof ApiError) return err;
  if (err?.name === "ZodError") {
    const details = {};
    for (const issue of err.issues || []) {
      const key = issue.path?.join(".") || "_";
      if (!details[key]) details[key] = issue.message;
    }
    return validationError(details);
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {}).filter((k) => k !== "tenantId" && k !== "isDeleted")[0];
    const label = { sku: "SKU", barcode: "Barcode", email: "Email", name: "Name", invoiceNumber: "Invoice number", slug: "Business URL", code: "Code" }[field] || "A record";
    return conflict(`${label} is already in use.`, field ? { [field]: `${label} is already in use.` } : undefined);
  }
  if (err?.name === "CastError") return notFound();
  if (err?.name === "ValidationError" && err.errors) {
    const details = {};
    for (const [k, v] of Object.entries(err.errors)) details[k] = v.message;
    return validationError(details);
  }
  return null;
}
