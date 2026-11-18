import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
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
    giftBoxSnapshot: {
      name: { type: String, default: "" },
      mode: { type: String, default: "" },
      occasion: { type: String, default: "" },
      price: { type: Number, default: 0 },
      requiredSelectionCount: { type: Number, default: 0 },
      selectedItems: { type: [mongoose.Schema.Types.Mixed], default: [] }
    },
    inventoryAllocations: { type: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, quantity: { type: Number, min: 0 } }], default: [] },
    buildSnapshot: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: ["website", "manual", "whatsapp"], default: "website" },
    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, "An order requires at least one item"]
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
    paymentMethod: { type: String, enum: ["cod", "online", "bank", "cash"], required: true },
    paymentStatus: { type: String, enum: ["pending", "processing", "paid", "failed", "payment-mismatch"], default: "pending" },
    paymentReference: { type: String, default: "" },
    paymentProvider: { type: String, default: "" },
    paymentId: { type: String, default: "" },
    paymentMethodDetail: { type: String, default: "" },
    paymentStatusMessage: { type: String, default: "" },
    paymentAudit: {
      type: [{
        from: { type: String, default: "" },
        to: { type: String, default: "" },
        reference: { type: String, default: "" },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now }
      }],
      default: []
    },
    paidAt: { type: Date },
    inventoryDeducted: { type: Boolean, default: false },
    paymentSlip: {
      name: { type: String, default: "" },
      type: { type: String, default: "" },
      data: { type: String, default: "" }
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
    trackingNumber: { type: String, default: "", trim: true },
    trackingUrl: { type: String, default: "", trim: true },
    shippedAt: { type: Date },
    statusHistory: {
      type: [{
        from: { type: String, default: "" },
        to: { type: String, default: "" },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: "" }
      }],
      default: []
    },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "payment-mismatch", "fraud-warning"],
      default: "confirmed"
    }
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ source: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index(
  { paymentId: 1 },
  { unique: true, partialFilterExpression: { paymentId: { $type: "string", $ne: "" } } }
);

export default mongoose.model("Order", orderSchema);
