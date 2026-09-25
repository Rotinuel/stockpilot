import { Schema, baseOptions, defineModel, tenantField } from "./_helpers.js";

const CategorySchema = new Schema(
  {
    tenantId: tenantField,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
  },
  baseOptions,
);

CategorySchema.index({ tenantId: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export default defineModel("Category", CategorySchema);
