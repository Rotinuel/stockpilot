// Convert Mongo documents (ObjectId, Date, Decimal) into plain JSON-safe
// objects before passing them from Server Components to Client Components.
export function toPlain(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
