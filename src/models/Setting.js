import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    shippingFee: {
      type: Number,
      required: true,
      default: 500
    },
    freeShippingThreshold: {
      type: Number,
      required: true,
      default: 15000
    },
    websiteShippingCost: {
      type: Number,
      required: true,
      default: 0
    },
    proformaShippingCost: {
      type: Number,
      required: true,
      default: 0
    },
    categoryCosts: {
      type: Map,
      of: {
        fruitCost: { type: Number, default: 0 },
        packingCost: { type: Number, default: 0 },
        stickerCost: { type: Number, default: 0 }
      },
      default: {}
    },
    productCosts: {
      type: Map,
      of: {
        fruitCost: { type: Number, default: 0 },
        packingCost: { type: Number, default: 0 },
        stickerCost: { type: Number, default: 0 }
      },
      default: {}
    }
  },
  { timestamps: true }
);

export default mongoose.model("Setting", settingSchema);
