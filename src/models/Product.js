import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, default: "", lowercase: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, maxlength: 1200 },
    approved: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const specSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    value: { type: String, required: true, trim: true, maxlength: 160 }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, default: "", trim: true, maxlength: 60 },
    brand: { type: String, default: "", trim: true, maxlength: 60 },
    description: { type: String, required: true, trim: true, maxlength: 600 },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: 0, min: 0 },
    unit: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    productionCost: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, default: "" },
    emoji: { type: String, default: "NUT" },
    color: { type: String, default: "#b87445" },
    featured: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    showOnShop: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    specs: { type: [specSchema], default: [] },
    reviews: { type: [reviewSchema], default: [] }
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text", category: "text" });
productSchema.index({ active: 1, showOnShop: 1, category: 1, featured: -1, createdAt: -1 });
productSchema.index({ brand: 1, category: 1 });
productSchema.index({ active: 1, showOnShop: 1, category: 1, subcategory: 1 });

export default mongoose.model("Product", productSchema);
