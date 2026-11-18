import mongoose from "mongoose";

const productDiscountSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    percentage: { type: Number, required: true, min: 0.01, max: 100 },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

productDiscountSchema.index({ product: 1, active: 1, startDate: 1, endDate: 1 });

export default mongoose.model("ProductDiscount", productDiscountSchema);
