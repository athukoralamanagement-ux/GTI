import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Offer from "../models/Offer.js";
import Product from "../models/Product.js";
import Setting from "../models/Setting.js";
import { sendOrderEmail } from "../utils/emailService.js";
import { getOfferState, hasEligibleItems } from "./offerController.js";
import { buildAuthoritativeOrderItems, inventoryAllocationsFor } from "../utils/orderItems.js";

const productSalePrice = (product) => {
  const price = Number(product.price) || 0;
  const discountPrice = Number(product.discountPrice) || 0;
  return discountPrice > 0 && discountPrice < price ? discountPrice : price;
};

const parseUnitGrams = (unit = "") => {
  const match = String(unit).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g)/);
  if (!match) return 0;
  return match[2] === "kg" ? Number(match[1]) * 1000 : Number(match[1]);
};

const getPackMultiplier = (selectedUnit, baseUnit) => {
  const selectedGrams = parseUnitGrams(selectedUnit);
  const baseGrams = parseUnitGrams(baseUnit);
  if (!selectedGrams || !baseGrams) return { valid: true, multiplier: 1 };
  const ratio = selectedGrams / baseGrams;
  const multiplier = Math.round(ratio);
  if (selectedGrams < baseGrams || Math.abs(ratio - multiplier) > 0.001) {
    return { valid: false, multiplier: 1 };
  }
  return { valid: true, multiplier: Math.max(1, multiplier) };
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedSlipTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const maxSlipBytes = 3 * 1024 * 1024;

const badRequest = (res, message) => {
  res.status(400);
  throw new Error(message);
};

const cleanText = (value, max = 500) => String(value || "").trim().slice(0, max);

const validObjectIds = (ids = []) => ids.every((id) => mongoose.Types.ObjectId.isValid(String(id || "")));

const safeSendOrderEmail = async (order, kind) => {
  try {
    await sendOrderEmail(order, kind);
  } catch (error) {
    console.error("Order email failed", { orderId: String(order?._id || ""), kind, message: error.message });
  }
};

const validatePaymentSlip = (res, paymentSlip) => {
  if (!paymentSlip?.data || !paymentSlip?.name || !paymentSlip?.type) {
    badRequest(res, "Upload your bank payment slip before placing the order");
  }
  const type = cleanText(paymentSlip.type, 80).toLowerCase();
  if (!allowedSlipTypes.has(type)) {
    badRequest(res, "Payment slip must be a PDF, JPG, PNG, or WEBP file");
  }
  const match = String(paymentSlip.data).match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1].toLowerCase() !== type) {
    badRequest(res, "Payment slip file data is invalid");
  }
  const size = Buffer.byteLength(match[2], "base64");
  if (size > maxSlipBytes) {
    badRequest(res, "Payment slip must be smaller than 3MB");
  }
  return {
    name: cleanText(paymentSlip.name, 180).replace(/[<>:"/\\|?*\x00-\x1F]/g, "-"),
    type,
    data: paymentSlip.data
  };
};

const reserveOfferUsage = async (orderLike) => {
  if (!orderLike.offer || !(Number(orderLike.offerDiscountAmount || orderLike.discountAmount) > 0)) return null;
  const now = new Date();
  const updated = await Offer.findOneAndUpdate(
    {
      _id: orderLike.offer,
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { usageLimitType: "unlimited" },
        { usageLimitType: "limited", $expr: { $lt: ["$usedCount", "$usageLimit"] } }
      ]
    },
    {
      $inc: {
        usedCount: 1,
        "stats.orders": 1,
        "stats.revenue": Number(orderLike.total) || 0,
        "stats.discountGiven": Number(orderLike.offerDiscountAmount || orderLike.discountAmount) || 0
      }
    },
    { new: true }
  );
  if (!updated) throw new Error("This offer is no longer available.");
  return {
    offer: orderLike.offer,
    revenue: Number(orderLike.total) || 0,
    discount: Number(orderLike.offerDiscountAmount || orderLike.discountAmount) || 0
  };
};

export const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod, paymentSlip, offerCode } = req.body;
  if (!Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error("Your cart is empty");
  }
  if (!["bank", "cod"].includes(paymentMethod)) badRequest(res, "Choose bank transfer or cash on delivery. PayHere online orders must start from the payment gateway.");
  const safePaymentSlip = paymentMethod === "bank" ? validatePaymentSlip(res, paymentSlip) : undefined;
  const normalizedAddress = {
    name: cleanText(shippingAddress?.name || req.user.name, 120),
    email: cleanText(shippingAddress?.email || "", 160).toLowerCase(),
    phone: cleanText(shippingAddress?.phone || "", 40),
    district: cleanText(shippingAddress?.district || shippingAddress?.city || "", 80),
    houseNumberStreet: cleanText(shippingAddress?.houseNumberStreet || shippingAddress?.street || "", 240),
    apartment: cleanText(shippingAddress?.apartment || "", 160),
    street: cleanText(shippingAddress?.street || shippingAddress?.houseNumberStreet || "", 240),
    city: cleanText(shippingAddress?.city || shippingAddress?.district || "", 80),
    postalCode: cleanText(shippingAddress?.postalCode || "", 30)
  };
  if (normalizedAddress.email && !emailPattern.test(normalizedAddress.email)) badRequest(res, "Enter a valid email address.");
  if (!normalizedAddress.phone || !normalizedAddress.district || !normalizedAddress.houseNumberStreet || !normalizedAddress.city) {
    badRequest(res, "Complete delivery details are required");
  }

  const { items: orderItems, productMap, stockRequested } = await buildAuthoritativeOrderItems(items);

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let activeOffer = null;
  let offerDiscountAmount = 0;
  if (offerCode) {
    activeOffer = await Offer.findOne({ code: String(offerCode).toUpperCase() });
    const offerState = getOfferState(activeOffer);
    if (!offerState.valid) {
      res.status(400);
      throw new Error(offerState.message);
    }
    if (!hasEligibleItems(activeOffer, orderItems, productMap)) {
      res.status(400);
      throw new Error("This offer is not available for the selected products.");
    }
    const minimum = Number(activeOffer.minOrderAmount) || 0;
    if (subtotal >= minimum) {
      offerDiscountAmount = Math.round((subtotal * (Number(activeOffer.discountPercentage) || 0)) / 100);
    }
  }
  const settings = await Setting.findOne() || { websiteShippingCost: 0 };
  const shippingFee = Number(settings.websiteShippingCost) || 0;
  const shippingCost = shippingFee;
  const paymentStatus = "pending";
  const paymentReference = "";
  const status = paymentMethod === "cod" ? "confirmed" : "pending";
  const shouldReserveStockNow = paymentMethod !== "online";

  const decremented = [];
  if (shouldReserveStockNow) {
    try {
      for (const [productId, quantity] of stockRequested.entries()) {
        const result = await Product.updateOne(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } }
        );
        if (!result.modifiedCount) throw new Error("Product stock changed. Please review your cart.");
        decremented.push({ product: productId, quantity });
      }
    } catch (error) {
      await Promise.all(decremented.map((item) =>
        Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
      ));
      throw error;
    }
  }

  let createdOrder;
  try {
    createdOrder = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress: normalizedAddress,
      paymentMethod,
      paymentStatus,
      paymentReference,
      paymentSlip: safePaymentSlip,
      subtotal,
      discountPercentage: activeOffer ? Number(activeOffer.discountPercentage) || 0 : 0,
      discountAmount: offerDiscountAmount,
      offer: activeOffer?._id,
      offerCode: activeOffer?.code || "",
      offerTitle: activeOffer?.title || "",
      offerDiscountPercentage: activeOffer ? Number(activeOffer.discountPercentage) || 0 : 0,
      offerDiscountAmount,
      shippingFee,
      shippingCost,
      total: subtotal - offerDiscountAmount + shippingFee,
      inventoryDeducted: shouldReserveStockNow,
      status
    });
  } catch (error) {
    if (shouldReserveStockNow) {
      await Promise.all(inventoryAllocationsFor({ items: orderItems }).map((item) =>
        Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
      ));
    }
    throw error;
  }
  try {
    if (paymentMethod !== "online" && activeOffer && offerDiscountAmount > 0) {
      await reserveOfferUsage(createdOrder);
    }
  } catch (error) {
    if (shouldReserveStockNow) {
      await Promise.all(inventoryAllocationsFor({ items: orderItems }).map((item) =>
        Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
      ));
    }
    await Order.findByIdAndDelete(createdOrder._id);
    throw error;
  }
  if (paymentMethod !== "online") await safeSendOrderEmail(createdOrder, status === "pending" ? "pending" : "confirmed");
  res.status(201).json(createdOrder);
});

export const createManualOrder = asyncHandler(async (req, res) => {
  const { items, customer = {}, shippingAddress = {}, paymentMethod = "bank", paymentStatus = "pending", paymentReference = "", discountPercentage = 0 } = req.body;
  if (!Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error("Add at least one product to create an invoice");
  }
  if (!["cod", "online", "bank", "cash"].includes(paymentMethod)) {
    res.status(400);
    throw new Error("Choose a valid payment method");
  }
  if (!["pending", "paid", "failed"].includes(paymentStatus)) {
    res.status(400);
    throw new Error("Choose a valid payment status");
  }

  const normalizedAddress = {
    name: cleanText(customer.name || shippingAddress.name || "WhatsApp customer", 120),
    email: cleanText(customer.email || shippingAddress.email || "-", 160).toLowerCase(),
    phone: cleanText(customer.phone || shippingAddress.phone || "", 40),
    district: cleanText(shippingAddress.district || "Courier delivery", 80),
    houseNumberStreet: cleanText(shippingAddress.houseNumberStreet || shippingAddress.street || "", 240),
    apartment: cleanText(shippingAddress.apartment || "", 160),
    street: cleanText(shippingAddress.street || shippingAddress.houseNumberStreet || "", 240),
    city: cleanText(shippingAddress.city || shippingAddress.district || "Courier delivery", 80),
    postalCode: cleanText(shippingAddress.postalCode || "-", 30)
  };
  if (!normalizedAddress.name || !normalizedAddress.phone || !normalizedAddress.houseNumberStreet) {
    res.status(400);
    throw new Error("Customer name, phone, and delivery address are required");
  }
  if (normalizedAddress.email && normalizedAddress.email !== "-" && !emailPattern.test(normalizedAddress.email)) {
    badRequest(res, "Enter a valid email address.");
  }

  const { items: orderItems, stockRequested } = await buildAuthoritativeOrderItems(items, { includeHiddenProducts: true });

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const parsedDiscountPercentage = Math.min(100, Math.max(0, Number(discountPercentage) || 0));
  const discountAmount = (subtotal * parsedDiscountPercentage) / 100;
  const discountedSubtotal = subtotal - discountAmount;
  const settings = await Setting.findOne() || { proformaShippingCost: 0 };
  const shippingFee = Number(settings.proformaShippingCost) || 0;
  const shippingCost = shippingFee;
  const safePaymentReference = cleanText(paymentReference, 160);
  const decremented = [];

  // A Proforma invoice is a quotation until payment is confirmed. It checks
  // availability, but never reserves or deducts stock while it is pending.
  if (paymentStatus === "paid") {
    try {
      for (const [productId, quantity] of stockRequested.entries()) {
        const result = await Product.updateOne(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } }
        );
        if (!result.modifiedCount) throw new Error("Product stock changed. Please review the invoice items.");
        decremented.push({ product: productId, quantity });
      }
    } catch (error) {
      await Promise.all(decremented.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
      throw error;
    }
  }

  try {
    const createdOrder = await Order.create({
      source: "whatsapp",
      items: orderItems,
      shippingAddress: normalizedAddress,
      paymentMethod,
      paymentStatus,
      paymentReference: safePaymentReference,
      subtotal,
      discountPercentage: parsedDiscountPercentage,
      discountAmount,
      shippingFee,
      shippingCost,
      total: discountedSubtotal + shippingFee,
      inventoryDeducted: paymentStatus === "paid",
      paidAt: paymentStatus === "paid" ? new Date() : undefined,
      status: "confirmed"
    });
    if (paymentStatus === "paid") {
      createdOrder.paymentAudit.push({ from: "", to: "paid", reference: safePaymentReference, changedBy: req.user._id });
      await createdOrder.save();
    }
    res.status(201).json(createdOrder);
  } catch (error) {
    if (decremented.length) await Promise.all(decremented.map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
    throw error;
  }
});

export const updateManualOrder = asyncHandler(async (req, res) => {
  const { items, customer = {}, shippingAddress = {}, paymentMethod = "bank", paymentStatus = "pending", paymentReference = "", discountPercentage = 0 } = req.body;
  if (!Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error("Add at least one product to update the invoice");
  }
  if (!["cod", "online", "bank", "cash"].includes(paymentMethod)) {
    res.status(400);
    throw new Error("Choose a valid payment method");
  }
  if (!["pending", "paid", "failed"].includes(paymentStatus)) {
    res.status(400);
    throw new Error("Choose a valid payment status");
  }

  const order = await Order.findById(req.params.id);
  if (!order || !["whatsapp", "manual"].includes(order.source)) {
    res.status(404);
    throw new Error("Proforma invoice not found");
  }

  const normalizedAddress = {
    name: cleanText(customer.name || shippingAddress.name || order.shippingAddress?.name || "WhatsApp customer", 120),
    email: cleanText(customer.email || shippingAddress.email || order.shippingAddress?.email || "-", 160).toLowerCase(),
    phone: cleanText(customer.phone || shippingAddress.phone || order.shippingAddress?.phone || "", 40),
    district: cleanText(shippingAddress.district || order.shippingAddress?.district || "Courier delivery", 80),
    houseNumberStreet: cleanText(shippingAddress.houseNumberStreet || shippingAddress.street || order.shippingAddress?.houseNumberStreet || order.shippingAddress?.street || "", 240),
    apartment: cleanText(shippingAddress.apartment || "", 160),
    street: cleanText(shippingAddress.street || shippingAddress.houseNumberStreet || "", 240),
    city: cleanText(shippingAddress.city || shippingAddress.district || order.shippingAddress?.city || "Courier delivery", 80),
    postalCode: cleanText(shippingAddress.postalCode || order.shippingAddress?.postalCode || "-", 30)
  };
  if (!normalizedAddress.name || !normalizedAddress.phone || !normalizedAddress.houseNumberStreet) {
    res.status(400);
    throw new Error("Customer name, phone, and delivery address are required");
  }
  if (normalizedAddress.email && normalizedAddress.email !== "-" && !emailPattern.test(normalizedAddress.email)) {
    badRequest(res, "Enter a valid email address.");
  }

  const session = await mongoose.startSession();
  try {
    let updatedOrder;
    await session.withTransaction(async () => {
      const transactionalOrder = await Order.findById(req.params.id).session(session);
      if (!transactionalOrder || !["whatsapp", "manual"].includes(transactionalOrder.source)) throw Object.assign(new Error("Proforma invoice not found"), { statusCode: 404 });

      // Pending Proformas do not touch inventory. A paid Proforma first puts
      // its old allocation back before safely applying its replacement.
      if (transactionalOrder.inventoryDeducted) {
        await Promise.all(inventoryAllocationsFor(transactionalOrder).map((item) =>
          Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session })
        ));
      }
      const { items: orderItems } = await buildAuthoritativeOrderItems(items, { session, includeHiddenProducts: true });
      if (paymentStatus === "paid") {
        for (const allocation of inventoryAllocationsFor({ items: orderItems })) {
          const result = await Product.updateOne({ _id: allocation.product, stock: { $gte: allocation.quantity } }, { $inc: { stock: -allocation.quantity } }, { session });
          if (!result.modifiedCount) throw new Error("Product stock changed. Please review the invoice items.");
        }
      }

      const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const parsedDiscountPercentage = Math.min(100, Math.max(0, Number(discountPercentage) || 0));
      const discountAmount = (subtotal * parsedDiscountPercentage) / 100;
      const discountedSubtotal = subtotal - discountAmount;
      const settings = await Setting.findOne().session(session) || { proformaShippingCost: 0 };
      const shippingFee = Number(settings.proformaShippingCost) || 0;

      transactionalOrder.items = orderItems;
      transactionalOrder.shippingAddress = normalizedAddress;
      transactionalOrder.paymentMethod = paymentMethod;
      if (transactionalOrder.paymentStatus !== paymentStatus) transactionalOrder.paymentAudit.push({ from: transactionalOrder.paymentStatus, to: paymentStatus, reference: cleanText(paymentReference, 160), changedBy: req.user._id });
      transactionalOrder.paymentStatus = paymentStatus;
      transactionalOrder.paymentReference = cleanText(paymentReference, 160);
      if (transactionalOrder.paymentStatus === "paid") transactionalOrder.paidAt = transactionalOrder.paidAt || new Date();
      transactionalOrder.subtotal = subtotal;
      transactionalOrder.discountPercentage = parsedDiscountPercentage;
      transactionalOrder.discountAmount = discountAmount;
      transactionalOrder.shippingFee = shippingFee;
      transactionalOrder.shippingCost = shippingFee;
      transactionalOrder.total = discountedSubtotal + shippingFee;
      transactionalOrder.inventoryDeducted = paymentStatus === "paid";
      updatedOrder = await transactionalOrder.save({ session });
    });
    res.json(updatedOrder);
  } catch (error) {
    if (/Transaction numbers are only allowed|replica set/i.test(error.message || "")) {
      res.status(503);
      throw new Error("Proforma invoice changes require MongoDB replica-set transactions.");
    }
    throw error;
  } finally {
    await session.endSession();
  }
});

export const myOrders = asyncHandler(async (req, res) => {
  res.json(await Order.find({
    user: req.user._id,
    deletedAt: { $exists: false },
    $or: [
      { paymentMethod: { $ne: "online" } },
      { paymentMethod: "online", paymentStatus: "paid" }
    ]
  }).select("-paymentSlip.data").sort({ createdAt: -1 }));
});

export const listOrders = asyncHandler(async (_req, res) => {
  const limit = Math.min(200, Math.max(1, Number(_req.query.limit) || 100));
  const page = Math.max(1, Number(_req.query.page) || 1);
  res.json(await Order.find({ deletedAt: { $exists: false } }).select("-paymentSlip.data").populate("user", "name email").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit));
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("user", "name email role");
  if (!order || order.deletedAt) {
    res.status(404);
    throw new Error("Order not found");
  }
  const orderUserId = order.user?._id || order.user;
  if (req.user.role !== "admin" && String(orderUserId) !== String(req.user._id)) {
    res.status(404);
    throw new Error("Order not found");
  }
  if (req.user.role !== "admin" && order.paymentMethod === "online" && order.paymentStatus !== "paid") {
    res.status(404);
    throw new Error("Order not found");
  }
  res.json(order);
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const allowed = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "payment-mismatch", "fraud-warning"];
  if (!allowed.includes(req.body.status)) {
    res.status(400);
    throw new Error("Invalid order status");
  }
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const previousStatus = order.status;
  order.status = req.body.status;
  if (req.body.status === "shipped") {
    const trackingNumber = String(req.body.trackingNumber || "").trim();
    const trackingUrl = String(req.body.trackingUrl || "").trim();
    if (!trackingNumber || !trackingUrl) {
      res.status(400);
      throw new Error("Tracking number and tracking website are required when marking an order as shipped");
    }
    order.trackingNumber = trackingNumber;
    order.trackingUrl = trackingUrl;
    order.shippedAt = order.shippedAt || new Date();
  }
  if (previousStatus !== req.body.status) {
    order.statusHistory.push({ from: previousStatus, to: req.body.status, changedBy: req.user._id });
  }
  const savedOrder = await order.save();
  if (previousStatus !== savedOrder.status) await safeSendOrderEmail(savedOrder, savedOrder.status);
  res.json(savedOrder);
});

export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const allowed = ["pending", "paid", "failed"];
  if (!allowed.includes(req.body.paymentStatus)) {
    res.status(400);
    throw new Error("Invalid payment status");
  }
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  if (order.paymentMethod === "online") {
    res.status(400);
    throw new Error("PayHere payment status is controlled by the verified PayHere notification.");
  }
  if (req.body.paymentStatus === "paid" && order.paymentMethod === "bank" && !String(req.body.paymentReference || "").trim()) {
    res.status(400);
    throw new Error("Payment reference is required when marking a bank transfer as paid");
  }
  const isProformaInvoice = ["whatsapp", "manual"].includes(order.source);
  if (!isProformaInvoice) {
    const previousPaymentStatus = order.paymentStatus;
    order.paymentStatus = req.body.paymentStatus;
    if (req.body.paymentReference !== undefined) order.paymentReference = cleanText(req.body.paymentReference, 160);
    if (previousPaymentStatus !== order.paymentStatus) {
      order.paymentAudit.push({ from: previousPaymentStatus, to: order.paymentStatus, reference: order.paymentReference, changedBy: req.user._id });
      if (order.paymentStatus === "paid") order.paidAt = order.paidAt || new Date();
    }
    return res.json(await order.save());
  }

  const session = await mongoose.startSession();
  try {
    let saved;
    await session.withTransaction(async () => {
      const transactionalOrder = await Order.findById(req.params.id).session(session);
      if (!transactionalOrder) throw Object.assign(new Error("Order not found"), { statusCode: 404 });
      const nextStatus = req.body.paymentStatus;
      const shouldDeduct = nextStatus === "paid";
      if (shouldDeduct && !transactionalOrder.inventoryDeducted) {
        for (const allocation of inventoryAllocationsFor(transactionalOrder)) {
          const result = await Product.updateOne({ _id: allocation.product, stock: { $gte: allocation.quantity } }, { $inc: { stock: -allocation.quantity } }, { session });
          if (!result.modifiedCount) throw new Error("Product stock changed. This Proforma invoice cannot be marked paid.");
        }
        transactionalOrder.inventoryDeducted = true;
      } else if (!shouldDeduct && transactionalOrder.inventoryDeducted) {
        await Promise.all(inventoryAllocationsFor(transactionalOrder).map((allocation) =>
          Product.updateOne({ _id: allocation.product }, { $inc: { stock: allocation.quantity } }, { session })
        ));
        transactionalOrder.inventoryDeducted = false;
      }
      const previousPaymentStatus = transactionalOrder.paymentStatus;
      transactionalOrder.paymentStatus = nextStatus;
      if (req.body.paymentReference !== undefined) transactionalOrder.paymentReference = cleanText(req.body.paymentReference, 160);
      if (previousPaymentStatus !== nextStatus) {
        transactionalOrder.paymentAudit.push({ from: previousPaymentStatus, to: nextStatus, reference: transactionalOrder.paymentReference, changedBy: req.user._id });
        if (nextStatus === "paid") transactionalOrder.paidAt = transactionalOrder.paidAt || new Date();
      }
      saved = await transactionalOrder.save({ session });
    });
    res.json(saved);
  } catch (error) {
    if (/Transaction numbers are only allowed|replica set/i.test(error.message || "")) {
      res.status(503);
      throw new Error("Marking a Proforma invoice paid requires MongoDB replica-set transactions.");
    }
    throw error;
  } finally {
    await session.endSession();
  }
});

export const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const isProformaInvoice = ["whatsapp", "manual"].includes(order.source);
  if (isProformaInvoice) {
    if (order.inventoryDeducted) {
      await Promise.all(inventoryAllocationsFor(order).map((item) =>
        Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
      ));
    }
    await Order.findByIdAndDelete(order._id);
    return res.json({ message: "Proforma invoice deleted permanently" });
  }
  if (order.deletedAt) return res.json({ message: "Order already deleted" });
  if (order.inventoryDeducted && order.status !== "delivered") {
    await Promise.all(inventoryAllocationsFor(order).map((item) =>
      Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
    ));
    order.inventoryDeducted = false;
  }
  order.deletedAt = new Date();
  order.deletedBy = req.user._id;
  order.statusHistory.push({ from: order.status, to: "cancelled", changedBy: req.user._id, note: "Order deleted by admin; stock restored when applicable." });
  order.status = "cancelled";
  await order.save();
  res.json({ message: "Order deleted successfully" });
});
