import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    image: { type: String, default: "" },
    // Admin-managed subcategories, used by the product editor and shop filters.
    subcategories: {
      type: [{ type: String, trim: true, maxlength: 60 }],
      default: []
    },
    // Lower numbers appear first in navigation and filter lists.
    order: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
    showInNav: { type: Boolean, default: true }
  },
  { timestamps: true }
);

categorySchema.index({ active: 1, showInNav: 1, order: 1, name: 1 });

export default mongoose.model("Category", categorySchema);
