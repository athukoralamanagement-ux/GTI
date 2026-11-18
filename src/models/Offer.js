import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    type: {
      type: String,
      enum: ["Wedding", "Birthday", "Corporate", "VIP", "Festival", "Seasonal", "Custom"],
      required: true
    },
    brideName: { type: String, default: "", trim: true },
    groomName: { type: String, default: "", trim: true },
    discountPercentage: { type: Number, required: true, min: 0, max: 100 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    bannerImage: { type: String, default: "" },
    description: { type: String, default: "", trim: true, maxlength: 1200 },
    welcomeMessage: { type: String, default: "Welcome to your GTI COMPUTERS offer.", trim: true, maxlength: 500 },
    shopButtonText: { type: String, default: "Shop Now", trim: true, maxlength: 80 },
    active: { type: Boolean, default: true },
    applyTo: { type: String, enum: ["all", "categories", "products"], default: "all" },
    selectedCategories: { type: [String], default: [] },
    selectedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    minOrderAmount: { type: Number, default: 0, min: 0 },
    usageLimitType: { type: String, enum: ["unlimited", "limited"], default: "unlimited" },
    usageLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    stats: {
      scans: { type: Number, default: 0 },
      visitors: { type: Number, default: 0 },
      orders: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
      discountGiven: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

offerSchema.virtual("conversionRate").get(function conversionRate() {
  return this.stats?.visitors ? Math.round((this.stats.orders / this.stats.visitors) * 10000) / 100 : 0;
});

offerSchema.set("toJSON", { virtuals: true });
offerSchema.set("toObject", { virtuals: true });
offerSchema.index({ code: 1, active: 1 });
offerSchema.index({ active: 1, startDate: 1, endDate: 1 });

export default mongoose.model("Offer", offerSchema);
