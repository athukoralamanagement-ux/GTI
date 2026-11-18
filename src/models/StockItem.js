import mongoose from "mongoose";

const stockItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ["raw", "packaging"], required: true, index: true },
  // Raw materials are stored in grams; packaging materials are stored as units.
  quantity: { type: Number, required: true, min: 0, default: 0 },
  unit: { type: String, required: true, trim: true, maxlength: 20 },
  // LKR per gram for raw materials; LKR per unit for packaging.
  unitCost: { type: Number, required: true, min: 0, default: 0 },
  lastPurchaseCost: { type: Number, required: true, min: 0, default: 0 },
  notes: { type: String, default: "", trim: true, maxlength: 500 }
}, { timestamps: true });

stockItemSchema.index({ type: 1, name: 1 }, { unique: true });

export default mongoose.model("StockItem", stockItemSchema);
