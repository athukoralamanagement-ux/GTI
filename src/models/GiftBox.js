import mongoose from "mongoose";

const giftBoxItemSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ["inventory", "custom"], default: "custom" },
    inventoryProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    productType: { type: String, default: "", trim: true, maxlength: 80 },
    weight: { type: String, default: "", trim: true, maxlength: 40 },
    unit: { type: String, default: "", trim: true, maxlength: 40 },
    quantity: { type: Number, min: 0.01, default: 1 },
    // Optional number of parent inventory packs consumed by one gift-box item.
    inventoryQuantity: { type: Number, min: 0, default: 0 },
    image: { type: String, default: "" }
  },
  { _id: true }
);

const giftBoxSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    shortDescription: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },
    occasion: { type: String, default: "Special", trim: true, maxlength: 80 },
    price: { type: Number, required: true, min: 0.01 },
    mode: { type: String, enum: ["selectable", "predefined"], default: "predefined" },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0 },
    desktopPoster: { type: String, default: "" },
    mobilePoster: { type: String, default: "" },
    predefinedItems: { type: [giftBoxItemSchema], default: [] },
    selectableItems: { type: [giftBoxItemSchema], default: [] },
    requiredSelectionCount: { type: Number, min: 1, default: 1 }
  },
  { timestamps: true }
);

giftBoxSchema.index({ active: 1, startDate: 1, endDate: 1, priority: -1 });

export default mongoose.model("GiftBox", giftBoxSchema);
