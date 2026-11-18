import mongoose from "mongoose";

const paymentSessionItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "gift-box", "build-part", "custom-build"], default: "product" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required() { return this.kind === "product"; } },
    giftBox: { type: mongoose.Schema.Types.ObjectId, ref: "GiftBox" },
    partId: { type: String, default: "" },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    stockQuantity: {
      type: Number,
      min: 0,
      default() {
        return this.quantity || 1;
      }
    },
    giftBoxSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    inventoryAllocations: { type: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, quantity: { type: Number, min: 0 } }], default: [] },
    buildSnapshot: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const paymentSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: {
      type: [paymentSessionItemSchema],
      validate: [(items) => items.length > 0, "A payment session requires at least one item"]
    },
    shippingAddress: {
      name: { type: String, required: true },
      email: { type: String, default: "", lowercase: true, trim: true },
      phone: { type: String, required: true },
      district: { type: String, required: true },
      houseNumberStreet: { type: String, required: true },
      apartment: { type: String, default: "" },
      street: { type: String, default: "" },
      city: { type: String, required: true },
      postalCode: { type: String, default: "" }
    },
    subtotal: { type: Number, required: true },
    discountPercentage: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
    offerCode: { type: String, default: "", uppercase: true, trim: true },
    offerTitle: { type: String, default: "" },
    offerDiscountPercentage: { type: Number, default: 0 },
    offerDiscountAmount: { type: Number, default: 0 },
    shippingFee: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: "LKR" },
    status: { type: String, enum: ["pending", "processing", "paid", "failed", "payment-mismatch"], default: "pending" },
    payherePaymentId: { type: String, default: "" },
    payhereMethod: { type: String, default: "" },
    statusMessage: { type: String, default: "" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

paymentSessionSchema.index({ user: 1, createdAt: -1 });
paymentSessionSchema.index({ status: 1, createdAt: -1 });
paymentSessionSchema.index(
  { payherePaymentId: 1 },
  { unique: true, partialFilterExpression: { payherePaymentId: { $type: "string", $ne: "" } } }
);

export default mongoose.model("PaymentSession", paymentSessionSchema);
