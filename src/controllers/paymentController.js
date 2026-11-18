import crypto from "node:crypto";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Offer from "../models/Offer.js";
import PaymentSession from "../models/PaymentSession.js";
import Product from "../models/Product.js";
import Setting from "../models/Setting.js";
import { sendOrderEmail } from "../utils/emailService.js";
import { getOfferState, hasEligibleItems } from "./offerController.js";
import { buildAuthoritativeOrderItems, inventoryAllocationsFor } from "../utils/orderItems.js";

const CURRENCY = "LKR";

const md5 = (value) => crypto.createHash("md5").update(String(value)).digest("hex");
const payhereMd5 = (value) => md5(value).toUpperCase();
const formatAmount = (amount) => Number(amount || 0).toFixed(2);
const cents = (amount) => Math.round(Number(amount || 0) * 100);
const cleanEnv = (value = "") => String(value).trim();
const emailLooksValid = (email = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
const validObjectIds = (ids = []) => ids.every((id) => mongoose.Types.ObjectId.isValid(String(id || "")));

const isSandbox = () => String(process.env.PAYHERE_SANDBOX || "true").toLowerCase() === "true";

const getPayHereConfig = () => {
  const sandbox = isSandbox();
  const merchantId = cleanEnv(sandbox ? process.env.PAYHERE_MERCHANT_ID_SANDBOX : process.env.PAYHERE_MERCHANT_ID_PROD);
  const merchantSecret = cleanEnv(sandbox ? process.env.PAYHERE_MERCHANT_SECRET_SANDBOX : process.env.PAYHERE_MERCHANT_SECRET_PROD);
  if (!merchantId || !merchantSecret) {
    const mode = sandbox ? "sandbox" : "production";
    throw new Error(`PayHere ${mode} credentials are not configured`);
  }
  return { sandbox, merchantId, merchantSecret };
};

const getNotifyUrl = () => {
  const notifyUrl = cleanEnv(process.env.PAYHERE_NOTIFY_URL);
  const apiPublicUrl = cleanEnv(process.env.API_PUBLIC_URL);
  if (notifyUrl) return notifyUrl;
  if (apiPublicUrl) return `${apiPublicUrl.replace(/\/$/, "")}/api/payment/notify`;
  return "https://www.gticomputers.lk/api/payment/notify";
};

const buildCheckoutHash = ({ merchantId, orderId, amount, merchantSecret }) => {
  const secretHash = payhereMd5(merchantSecret);
  return payhereMd5(`${merchantId}${orderId}${amount}${CURRENCY}${secretHash}`);
};

const buildNotifyHash = ({ merchantId, orderId, amount, currency, statusCode, merchantSecret }) => {
  const secretHash = payhereMd5(merchantSecret);
  return payhereMd5(`${merchantId}${orderId}${amount}${currency}${statusCode}${secretHash}`);
};

const getStockQuantity = (item) => Number(item.stockQuantity || item.quantity || 0);

const safeSendOrderEmail = async (order, kind) => {
  try {
    await sendOrderEmail(order, kind);
  } catch (error) {
    console.error("Order email failed", { orderId: String(order?._id || ""), kind, message: error.message });
  }
};

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

const buildOnlineSessionDraft = async ({ user, items, shippingAddress, offerCode }) => {
  if (!Array.isArray(items) || !items.length) {
    const error = new Error("Your cart is empty");
    error.statusCode = 400;
    throw error;
  }

  const normalizedAddress = {
    name: shippingAddress?.name || user.name,
    email: shippingAddress?.email || user.email || "",
    phone: shippingAddress?.phone || "",
    district: shippingAddress?.district || shippingAddress?.city || "",
    houseNumberStreet: shippingAddress?.houseNumberStreet || shippingAddress?.street || "",
    apartment: shippingAddress?.apartment || "",
    street: shippingAddress?.street || shippingAddress?.houseNumberStreet || "",
    city: shippingAddress?.city || shippingAddress?.district || "",
    postalCode: shippingAddress?.postalCode || ""
  };
  if (!emailLooksValid(normalizedAddress.email)) {
    const error = new Error("Email address is required for PayHere online payments");
    error.statusCode = 400;
    throw error;
  }
  if (!normalizedAddress.phone || !normalizedAddress.district || !normalizedAddress.houseNumberStreet || !normalizedAddress.city) {
    const error = new Error("Complete delivery details are required");
    error.statusCode = 400;
    throw error;
  }

  const { items: orderItems, productMap } = await buildAuthoritativeOrderItems(items);

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let activeOffer = null;
  let offerDiscountAmount = 0;
  if (offerCode) {
    activeOffer = await Offer.findOne({ code: String(offerCode).toUpperCase() });
    const offerState = getOfferState(activeOffer);
    if (!offerState.valid) {
      const error = new Error(offerState.message);
      error.statusCode = 400;
      throw error;
    }
    if (!hasEligibleItems(activeOffer, orderItems, productMap)) {
      const error = new Error("This offer is not available for the selected products.");
      error.statusCode = 400;
      throw error;
    }
    const minimum = Number(activeOffer.minOrderAmount) || 0;
    if (subtotal >= minimum) {
      offerDiscountAmount = Math.round((subtotal * (Number(activeOffer.discountPercentage) || 0)) / 100);
    }
  }

  const settings = await Setting.findOne() || { websiteShippingCost: 0 };
  const shippingFee = Number(settings.websiteShippingCost) || 0;
  return {
    user: user._id,
    items: orderItems,
    shippingAddress: normalizedAddress,
    subtotal,
    discountPercentage: activeOffer ? Number(activeOffer.discountPercentage) || 0 : 0,
    discountAmount: offerDiscountAmount,
    offer: activeOffer?._id,
    offerCode: activeOffer?.code || "",
    offerTitle: activeOffer?.title || "",
    offerDiscountPercentage: activeOffer ? Number(activeOffer.discountPercentage) || 0 : 0,
    offerDiscountAmount,
    shippingFee,
    shippingCost: shippingFee,
    total: subtotal - offerDiscountAmount + shippingFee
  };
};

const deductOrderInventory = async (order) => {
  const decremented = [];
  try {
    for (const item of inventoryAllocationsFor(order)) {
      const quantity = item.quantity;
      const result = await Product.updateOne(
        { _id: item.product, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } }
      );
      if (!result.modifiedCount) throw new Error(`Insufficient stock for ${item.name}`);
      decremented.push({ product: item.product, quantity });
    }
  } catch (error) {
    await Promise.all(decremented.map((item) =>
      Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
    ));
    throw error;
  }
  return decremented;
};

const recordOfferSuccess = async (order) => {
  if (!order.offer || !(Number(order.offerDiscountAmount || order.discountAmount) > 0)) return;
  const now = new Date();
  const updated = await Offer.findOneAndUpdate(
    {
      _id: order.offer,
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
        "stats.revenue": Number(order.total) || 0,
        "stats.discountGiven": Number(order.offerDiscountAmount || order.discountAmount) || 0
      }
    },
    { new: true }
  );
  if (!updated) throw new Error("Offer is no longer available.");
  return {
    offer: order.offer,
    revenue: Number(order.total) || 0,
    discount: Number(order.offerDiscountAmount || order.discountAmount) || 0
  };
};

const releaseOfferSuccess = async (reservation) => {
  if (!reservation?.offer) return;
  await Offer.updateOne(
    { _id: reservation.offer },
    {
      $inc: {
        usedCount: -1,
        "stats.orders": -1,
        "stats.revenue": -reservation.revenue,
        "stats.discountGiven": -reservation.discount
      }
    }
  );
};

const createOrderFromPaidSession = async ({ session, paymentId, method, statusMessage }) => {
  if (session.order) {
    const existingOrder = await Order.findById(session.order);
    if (existingOrder) return existingOrder;
  }

  const offerReservation = await recordOfferSuccess(session);
  let decremented = [];
  let order;
  try {
    decremented = await deductOrderInventory(session);
    order = await Order.create({
      user: session.user,
      source: "website",
      items: session.items,
      shippingAddress: session.shippingAddress,
      paymentMethod: "online",
      paymentStatus: "paid",
      paymentReference: paymentId || "",
      paymentProvider: "PayHere",
      paymentId: paymentId || "",
      paymentMethodDetail: method || "",
      paymentStatusMessage: statusMessage || "",
      paidAt: new Date(),
      inventoryDeducted: true,
      subtotal: session.subtotal,
      discountPercentage: session.discountPercentage,
      discountAmount: session.discountAmount,
      offer: session.offer,
      offerCode: session.offerCode,
      offerTitle: session.offerTitle,
      offerDiscountPercentage: session.offerDiscountPercentage,
      offerDiscountAmount: session.offerDiscountAmount,
      shippingFee: session.shippingFee,
      shippingCost: session.shippingCost,
      total: session.total,
      status: "confirmed"
    });
  } catch (error) {
    await Promise.all(decremented.map((item) =>
      Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
    ));
    await releaseOfferSuccess(offerReservation);
    throw error;
  }

  session.status = "paid";
  session.order = order._id;
  session.payherePaymentId = paymentId || "";
  session.payhereMethod = method || "";
  session.statusMessage = statusMessage || "";
  session.completedAt = new Date();
  await session.save();
  await safeSendOrderEmail(order, "confirmed");
  return order;
};

export const createPaymentHash = asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  let payable = null;
  let paymentType = "session";
  if (orderId) {
    if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
      res.status(400);
      throw new Error("Invalid order ID");
    }
    payable = await Order.findById(orderId);
    paymentType = "order";
    if (!payable || String(payable.user) !== String(req.user._id)) {
      res.status(404);
      throw new Error("Order not found");
    }
    if (payable.paymentMethod !== "online") {
      res.status(400);
      throw new Error("This order is not configured for PayHere online payment");
    }
    if (payable.paymentStatus === "paid") {
      res.status(400);
      throw new Error("This order has already been paid");
    }
    if (["cancelled", "payment-mismatch", "fraud-warning"].includes(payable.status)) {
      res.status(400);
      throw new Error("This order cannot be paid online");
    }
  } else {
    try {
      payable = await PaymentSession.create(await buildOnlineSessionDraft({
        user: req.user,
        items: req.body.items,
        shippingAddress: req.body.shippingAddress,
        offerCode: req.body.offerCode
      }));
    } catch (error) {
      res.status(error.statusCode || 400);
      throw error;
    }
  }

  const { sandbox, merchantId, merchantSecret } = getPayHereConfig();
  const amount = formatAmount(payable.total);
  const order_id = String(payable._id);
  if (!(Number(amount) > 0)) {
    res.status(400);
    throw new Error("PayHere payment amount must be greater than zero");
  }
  console.info("PayHere checkout hash created", {
    sandbox,
    merchantId,
    orderId: order_id,
    paymentType,
    amount,
    currency: CURRENCY,
    notifyUrl: getNotifyUrl(),
    returnDomain: cleanEnv(process.env.CLIENT_URL) || "client-origin"
  });

  res.json({
    hash: buildCheckoutHash({ merchantId, orderId: order_id, amount, merchantSecret }),
    merchant_id: merchantId,
    amount,
    currency: CURRENCY,
    order_id,
    payment_type: paymentType,
    sandbox,
    notify_url: getNotifyUrl()
  });
});

export const payhereNotify = asyncHandler(async (req, res) => {
  const {
    merchant_id,
    order_id,
    payment_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
    method,
    status_message
  } = req.body;

  if (!merchant_id || !order_id || !payment_id || !payhere_amount || !payhere_currency || !status_code || !md5sig) {
    return res.status(400).send("Missing PayHere fields");
  }
  if (!mongoose.Types.ObjectId.isValid(String(order_id))) {
    return res.status(400).send("Invalid Order ID");
  }

  const { merchantId, merchantSecret } = getPayHereConfig();
  if (String(merchant_id) !== String(merchantId)) {
    return res.status(400).send("Invalid Merchant");
  }

  const localSig = buildNotifyHash({
    merchantId: merchant_id,
    orderId: order_id,
    amount: payhere_amount,
    currency: payhere_currency,
    statusCode: status_code,
    merchantSecret
  });

  if (localSig !== String(md5sig || "").toUpperCase()) {
    return res.status(400).send("Invalid Signature");
  }

  let order = await Order.findById(order_id);
  const session = order ? null : await PaymentSession.findById(order_id);
  if (!order && !session) return res.status(404).send("Payment Not Found");

  if (order?.paymentStatus === "paid" || session?.status === "paid") {
    return res.status(200).send("Already Processed");
  }

  const payableTotal = order ? order.total : session.total;

  if (order) {
    order.paymentProvider = "PayHere";
    order.paymentId = payment_id || "";
    order.paymentMethodDetail = method || "";
    order.paymentStatusMessage = status_message || "";
    order.paymentReference = payment_id || order.paymentReference || "";
  }

  if (String(payhere_currency) !== CURRENCY || cents(payhere_amount) !== cents(payableTotal)) {
    console.error("PayHere fraud alert: amount/currency mismatch", {
      paymentIdForOrder: String(order?._id || session?._id),
      expectedAmount: formatAmount(payableTotal),
      receivedAmount: payhere_amount,
      expectedCurrency: CURRENCY,
      receivedCurrency: payhere_currency,
      paymentId: payment_id
    });
    if (order) {
      order.paymentStatus = "payment-mismatch";
      order.status = "payment-mismatch";
      await order.save();
    } else {
      session.status = "payment-mismatch";
      session.payherePaymentId = payment_id || "";
      session.payhereMethod = method || "";
      session.statusMessage = status_message || "Amount mismatch";
      await session.save();
    }
    return res.status(400).send("Amount Mismatch");
  }

  if (String(status_code) !== "2") {
    if (order) {
      await Order.updateOne(
        { _id: order._id, paymentStatus: { $nin: ["paid", "processing"] } },
        {
          $set: {
            paymentProvider: "PayHere",
            paymentId: payment_id || "",
            paymentMethodDetail: method || "",
            paymentStatusMessage: status_message || "",
            paymentReference: payment_id || order.paymentReference || "",
            paymentStatus: "failed"
          }
        }
      );
    } else {
      await PaymentSession.updateOne(
        { _id: session._id, status: { $nin: ["paid", "processing"] } },
        { $set: { status: "failed", payherePaymentId: payment_id || "", payhereMethod: method || "", statusMessage: status_message || "" } }
      );
    }
    return res.status(200).send("OK");
  }

  const processingCutoff = new Date(Date.now() - 10 * 60 * 1000);

  if (session) {
    const claimedSession = await PaymentSession.findOneAndUpdate(
      {
        _id: session._id,
        $or: [
          { status: { $in: ["pending", "failed"] } },
          { status: "processing", updatedAt: { $lt: processingCutoff } }
        ]
      },
      { $set: { status: "processing", payherePaymentId: payment_id || "", payhereMethod: method || "", statusMessage: status_message || "" } },
      { new: true }
    );
    if (!claimedSession) return res.status(200).send("Already Processing");
    try {
      await createOrderFromPaidSession({ session: claimedSession, paymentId: payment_id, method, statusMessage: status_message });
    } catch (error) {
      console.error("PayHere paid session fulfillment failed", {
        sessionId: String(claimedSession._id),
        paymentId: payment_id,
        message: error.message
      });
      claimedSession.status = "failed";
      claimedSession.statusMessage = `Payment received, but order creation failed: ${error.message}`;
      await claimedSession.save();
    }
    return res.status(200).send("OK");
  }

  const claimedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      $or: [
        { paymentStatus: { $in: ["pending", "failed"] } },
        { paymentStatus: "processing", updatedAt: { $lt: processingCutoff } }
      ]
    },
    {
      $set: {
        paymentStatus: "processing",
        paymentProvider: "PayHere",
        paymentId: payment_id || "",
        paymentMethodDetail: method || "",
        paymentStatusMessage: status_message || "",
        paymentReference: payment_id || order.paymentReference || ""
      }
    },
    { new: true }
  );
  if (!claimedOrder) return res.status(200).send("Already Processing");
  order = claimedOrder;

  if (!order.inventoryDeducted) {
    try {
      await deductOrderInventory(order);
      order.inventoryDeducted = true;
    } catch (error) {
      console.error("PayHere paid order stock fulfillment failed", {
        orderId: String(order._id),
        paymentId: payment_id,
        message: error.message
      });
      order.paymentStatus = "paid";
      order.status = "fraud-warning";
      order.paymentStatusMessage = `Payment received, but stock fulfillment failed: ${error.message}`;
      order.paidAt = new Date();
      await order.save();
      return res.status(200).send("OK");
    }
  }

  order.paymentStatus = "paid";
  order.status = "confirmed";
  order.paidAt = order.paidAt || new Date();
  await order.save();
  try {
    await recordOfferSuccess(order);
  } catch (error) {
    console.error("PayHere paid order offer fulfillment failed", {
      orderId: String(order._id),
      paymentId: payment_id,
      message: error.message
    });
    order.status = "fraud-warning";
    order.paymentStatusMessage = `Payment received, but offer fulfillment failed: ${error.message}`;
    await order.save();
  }
  await safeSendOrderEmail(order, "confirmed");

  return res.status(200).send("OK");
});

export const getPaymentStatus = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.orderId))) {
    res.status(400);
    throw new Error("Invalid order ID");
  }
  const order = await Order.findById(req.params.orderId);
  if (order) {
    if (String(order.user) !== String(req.user._id)) {
      res.status(404);
      throw new Error("Order not found");
    }
    return res.json({
      orderId: order._id,
      paymentId: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentProvider: order.paymentProvider,
      providerPaymentId: order.paymentId,
      total: order.total,
      message: order.paymentStatusMessage
    });
  }

  const session = await PaymentSession.findById(req.params.orderId);
  if (!session || String(session.user) !== String(req.user._id)) {
    res.status(404);
    throw new Error("Order not found");
  }
  res.json({
    orderId: session.order || null,
    paymentId: session._id,
    status: session.order ? "confirmed" : session.status,
    paymentStatus: session.status,
    paymentMethod: "online",
    paymentProvider: "PayHere",
    providerPaymentId: session.payherePaymentId,
    total: session.total,
    message: session.statusMessage
  });
});
