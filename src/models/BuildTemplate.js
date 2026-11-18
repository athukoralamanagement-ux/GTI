import mongoose from "mongoose";

const buildTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 140 },
    tagline: { type: String, default: "", trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 800 },
    image: { type: String, default: "" },
    badge: { type: String, default: "", trim: true, maxlength: 40 },
    parts: { type: [String], default: [] },
    // Computed from the canonical build-part catalog whenever the template is saved.
    price: { type: Number, default: 0, min: 0 },
    order: { type: Number, default: 100 },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

buildTemplateSchema.index({ active: 1, order: 1, name: 1 });

export default mongoose.model("BuildTemplate", buildTemplateSchema);
