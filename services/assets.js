// Image storage. Images are resized client-side (max ~800px) and stored in
// MongoDB as small binaries. Replace this module to use S3/Cloudinary.
import Asset from "../models/Asset.js";
import { badRequest, notFound } from "../lib/errors.js";
import { isValidObjectId } from "../lib/db.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 600 * 1024;

function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function saveAsset({ tenantId, userId, kind, file }) {
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("No file uploaded.");
  if (file.size > MAX_BYTES) throw badRequest("Image is too large (max 600 KB).");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf); // trust magic bytes, not the client-supplied type
  if (!type || !ALLOWED.has(type)) throw badRequest("Only JPEG, PNG or WebP images are allowed.");
  const asset = await Asset.create({ tenantId, uploadedBy: userId, kind, contentType: type, size: buf.length, data: buf });
  return { id: String(asset._id), url: `/api/assets/${asset._id}` };
}

export async function readAsset(id) {
  if (!isValidObjectId(String(id))) throw notFound();
  const asset = await Asset.findById(id).select("+data").lean();
  if (!asset) throw notFound();
  return asset;
}
