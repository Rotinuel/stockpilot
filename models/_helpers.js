import mongoose from "mongoose";

/** Register a model once (safe across Next.js hot reloads). */
export function defineModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

export const { Schema } = mongoose;
export const ObjectId = mongoose.Schema.Types.ObjectId;

/** Common option set: timestamps + clean JSON output. */
export const baseOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      delete ret.password;
      return ret;
    },
  },
};

/** Every tenant-owned document carries a required, indexed tenantId. */
export const tenantField = { type: ObjectId, ref: "Tenant", required: true, index: true };
