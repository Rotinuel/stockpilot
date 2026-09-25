import { Schema, ObjectId, defineModel } from "./_helpers.js";

// Small uploaded images (logos, product photos, avatars) stored in MongoDB.
// Swap for S3/Cloudinary by changing services/assets.js only.
const AssetSchema = new Schema(
  {
    tenantId: { type: ObjectId, ref: "Tenant", default: null, index: true },
    kind: { type: String, enum: ["logo", "product", "avatar"], default: "product" },
    contentType: { type: String, required: true },
    size: Number,
    data: { type: Buffer, required: true, select: false },
    uploadedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

export default defineModel("Asset", AssetSchema);
