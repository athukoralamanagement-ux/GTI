import asyncHandler from "express-async-handler";
import crypto from "crypto";
import mongoose from "mongoose";
import Offer from "../models/Offer.js";

const offerTypes = ["Wedding", "Birthday", "Corporate", "VIP", "Festival", "Seasonal", "Custom"];
const applyTargets = ["all", "categories", "products"];
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBannerBytes = 2 * 1024 * 1024;

const buildCode = () => `GTI-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const cleanText = (value, max = 500) => String(value || "").trim().slice(0, max);
const validateBannerImage = (image = "") => {
  const value = String(image || "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value.slice(0, 1200);
  const match = value.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    const error = new Error("Offer banner must be a valid image file");
    error.statusCode = 400;
    throw error;
  }
  const type = match[1].toLowerCase();
  if (!allowedImageTypes.has(type) || Buffer.byteLength(match[2], "base64") > maxBannerBytes) {
    const error = new Error("Offer banner must be a JPG, PNG, or WEBP file smaller than 2MB");
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const validateObjectIds = (ids = []) => {
  if (!ids.every((id) => mongoose.Types.ObjectId.isValid(String(id || "")))) {
    const error = new Error("One or more selected products are invalid");
    error.statusCode = 400;
    throw error;
  }
  return ids;
};

const sanitizeOfferPayload = (body) => {
  const type = offerTypes.includes(body.type) ? body.type : "Custom";
  const applyTo = applyTargets.includes(body.applyTo) ? body.applyTo : "all";
  return {
    title: cleanText(body.title, 140),
    type,
    brideName: type === "Wedding" ? cleanText(body.brideName, 80) : "",
    groomName: type === "Wedding" ? cleanText(body.groomName, 80) : "",
    discountPercentage: Math.min(100, Math.max(0, Number(body.discountPercentage) || 0)),
    startDate: body.startDate,
    endDate: body.endDate,
    bannerImage: validateBannerImage(body.bannerImage),
    description: cleanText(body.description, 1200),
    welcomeMessage: cleanText(body.welcomeMessage || "Welcome to your GTI COMPUTERS offer.", 500),
    shopButtonText: cleanText(body.shopButtonText || "Shop Now", 80),
    active: body.active !== false,
    applyTo,
    selectedCategories: applyTo === "categories" && Array.isArray(body.selectedCategories) ? body.selectedCategories.map((category) => cleanText(category, 80)).filter(Boolean) : [],
    selectedProducts: applyTo === "products" && Array.isArray(body.selectedProducts) ? validateObjectIds(body.selectedProducts) : [],
    minOrderAmount: Math.max(0, Number(body.minOrderAmount) || 0),
    usageLimitType: body.usageLimitType === "limited" ? "limited" : "unlimited",
    usageLimit: Math.max(0, Math.floor(Number(body.usageLimit) || 0))
  };
};

export const getOfferState = (offer) => {
  const now = new Date();
  if (!offer) return { valid: false, reason: "missing", message: "This offer could not be found." };
  if (!offer.active) return { valid: false, reason: "inactive", message: "This offer is no longer active." };
  if (new Date(offer.startDate) > now) return { valid: false, reason: "not-started", message: "This offer has not started yet." };
  if (new Date(offer.endDate) < now) return { valid: false, reason: "expired", message: "This offer has expired." };
  if (offer.usageLimitType === "limited" && Number(offer.usageLimit) > 0 && Number(offer.usedCount) >= Number(offer.usageLimit)) {
    return { valid: false, reason: "limit", message: "This offer has reached its order limit." };
  }
  return { valid: true, reason: "valid", message: "Offer is available." };
};

export const hasEligibleItems = (offer, orderItems, productMap) => {
  if (!offer || offer.applyTo === "all") return true;
  if (offer.applyTo === "categories") {
    const categories = new Set((offer.selectedCategories || []).map(String));
    return orderItems.some((item) => categories.has(String(productMap.get(String(item.product))?.category || "")));
  }
  if (offer.applyTo === "products") {
    const productIds = new Set((offer.selectedProducts || []).map((id) => String(id)));
    return orderItems.some((item) => productIds.has(String(item.product)));
  }
  return false;
};

export const listOffers = asyncHandler(async (_req, res) => {
  res.json(await Offer.find().populate("selectedProducts", "name category unit price discountPrice image").sort({ createdAt: -1 }));
});

export const createOffer = asyncHandler(async (req, res) => {
  const payload = sanitizeOfferPayload(req.body);
  if (!payload.title || !payload.startDate || !payload.endDate) {
    res.status(400);
    throw new Error("Offer title, start date, and end date are required");
  }
  if (new Date(payload.endDate) < new Date(payload.startDate)) {
    res.status(400);
    throw new Error("End date must be after start date");
  }
  let code = buildCode();
  while (await Offer.exists({ code })) code = buildCode();
  const offer = await Offer.create({ ...payload, code });
  res.status(201).json(offer);
});

export const updateOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) {
    res.status(404);
    throw new Error("Offer not found");
  }
  const payload = sanitizeOfferPayload(req.body);
  if (new Date(payload.endDate) < new Date(payload.startDate)) {
    res.status(400);
    throw new Error("End date must be after start date");
  }
  Object.assign(offer, payload);
  res.json(await offer.save());
});

export const toggleOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findById(req.params.id);
  if (!offer) {
    res.status(404);
    throw new Error("Offer not found");
  }
  offer.active = req.body.active !== undefined ? Boolean(req.body.active) : !offer.active;
  res.json(await offer.save());
});

export const deleteOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findByIdAndDelete(req.params.id);
  if (!offer) {
    res.status(404);
    throw new Error("Offer not found");
  }
  res.json({ message: "Offer deleted successfully" });
});

export const getOfferByCode = asyncHandler(async (req, res) => {
  const offer = await Offer.findOne({ code: String(req.params.code || "").toUpperCase() });
  if (!offer) {
    res.status(404);
    throw new Error("Offer not found");
  }
  offer.stats.scans += 1;
  await offer.save();
  res.json({ offer, state: getOfferState(offer) });
});

export const validateOfferByCode = asyncHandler(async (req, res) => {
  const offer = await Offer.findOne({ code: String(req.params.code || "").toUpperCase() });
  if (!offer) {
    res.status(404);
    throw new Error("Offer not found");
  }
  res.json({ offer, state: getOfferState(offer) });
});

export const trackOfferVisit = asyncHandler(async (req, res) => {
  const offer = await Offer.findOne({ code: String(req.params.code || "").toUpperCase() });
  if (!offer) {
    res.status(404);
    throw new Error("Offer not found");
  }
  offer.stats.visitors += 1;
  await offer.save();
  res.json({ offer, state: getOfferState(offer) });
});
