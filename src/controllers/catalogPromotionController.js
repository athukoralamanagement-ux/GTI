import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import GiftBox from "../models/GiftBox.js";
import Product from "../models/Product.js";
import ProductDiscount from "../models/ProductDiscount.js";
import slugify from "../utils/slugify.js";
import { decorateProductsWithDiscounts, discountPriceFor } from "../utils/catalogPricing.js";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 2 * 1024 * 1024;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const text = (value, max = 500) => String(value || "").trim().slice(0, max);
const validId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const asDate = (value, label) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw fail(`${label} is invalid`);
  return date;
};
const cleanImage = (value, label = "Image") => {
  const image = String(value || "");
  if (!image) return "";
  if (/^https?:\/\//i.test(image) || image.startsWith("/")) return image.slice(0, 1200);
  const match = image.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !imageTypes.has(match[1].toLowerCase()) || Buffer.byteLength(match?.[2] || "", "base64") > maxImageBytes) {
    throw fail(`${label} must be a JPG, PNG, or WEBP image smaller than 2MB`);
  }
  return image;
};

const giftBoxState = (giftBox, now = new Date()) => {
  if (!giftBox.active) return "disabled";
  if (new Date(giftBox.endDate) <= now) return "expired";
  if (new Date(giftBox.startDate) > now) return "scheduled";
  return "active";
};

const giftBoxWithStatus = (giftBox) => ({ ...(giftBox.toObject ? giftBox.toObject() : giftBox), status: giftBoxState(giftBox) });
const publicGiftItem = ({ inventoryProduct, inventoryQuantity, source, ...item }) => item;
const publicGiftBox = (giftBox) => {
  const data = giftBoxWithStatus(giftBox);
  return {
    ...data,
    predefinedItems: (data.predefinedItems || []).map(publicGiftItem),
    selectableItems: (data.selectableItems || []).map(publicGiftItem)
  };
};

const sanitizeItems = async (items, label) => {
  if (!Array.isArray(items)) return [];
  const cleaned = items.map((item) => {
    const source = item?.source === "inventory" ? "inventory" : "custom";
    const inventoryProduct = item?.inventoryProduct || null;
    if (inventoryProduct && !validId(inventoryProduct)) throw fail(`${label} contains an invalid inventory product`);
    const name = text(item?.name, 120);
    if (!name) throw fail(`${label} item name is required`);
    const quantity = Number(item?.quantity || 1);
    const inventoryQuantity = Number(item?.inventoryQuantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(inventoryQuantity) || inventoryQuantity < 0) throw fail(`${label} contains an invalid quantity`);
    return { source, inventoryProduct, name, productType: text(item?.productType, 80), weight: text(item?.weight, 40), unit: text(item?.unit, 40), quantity, inventoryQuantity, image: cleanImage(item?.image, `${label} item image`) };
  });
  const inventoryIds = cleaned.filter((item) => item.inventoryProduct).map((item) => item.inventoryProduct);
  if (inventoryIds.length) {
    const count = await Product.countDocuments({ _id: { $in: inventoryIds } });
    if (count !== new Set(inventoryIds.map(String)).size) throw fail(`${label} contains an unavailable inventory product`);
  }
  return cleaned;
};

const sanitizeGiftBox = async (body, existing = null) => {
  const mode = body.mode === "selectable" ? "selectable" : "predefined";
  const startDate = asDate(body.startDate, "Start date");
  const endDate = asDate(body.endDate, "End date");
  if (endDate <= startDate) throw fail("End date must be after start date");
  const name = text(body.name, 140);
  const price = Number(body.price);
  if (!name || !Number.isFinite(price) || price <= 0) throw fail("Gift box name and a price greater than zero are required");
  // Only validate the items used by the selected mode. The editor keeps a draft
  // list for the other mode so an admin can switch modes without losing work.
  const predefinedItems = mode === "predefined" ? await sanitizeItems(body.predefinedItems, "Predefined items") : [];
  const selectableItems = mode === "selectable" ? await sanitizeItems(body.selectableItems, "Selectable items") : [];
  const requiredSelectionCount = Math.floor(Number(body.requiredSelectionCount) || 0);
  if (mode === "predefined" && !predefinedItems.length) throw fail("A predefined gift box needs at least one item");
  if (mode === "selectable") {
    if (!selectableItems.length) throw fail("A selectable gift box needs at least one choice");
    if (requiredSelectionCount < 1 || requiredSelectionCount > selectableItems.length) throw fail("Required selections must be between 1 and the number of choices");
  }
  const desktopPoster = cleanImage(body.desktopPoster, "Desktop poster");
  const mobilePoster = cleanImage(body.mobilePoster, "Mobile poster");
  if (!desktopPoster || !mobilePoster) throw fail("Both desktop and mobile promotional posters are required");
  const baseSlug = slugify(body.slug || name);
  if (!baseSlug) throw fail("Gift box needs a valid name");
  let slug = baseSlug;
  if (!existing || slug !== existing.slug) {
    const conflict = await GiftBox.exists({ slug, _id: { $ne: existing?._id } });
    if (conflict) slug = `${baseSlug}-${Date.now().toString(36)}`;
  }
  return {
    name, slug, shortDescription: text(body.shortDescription, 300) || text(body.description, 300), description: text(body.description, 2000),
    occasion: text(body.occasion || "Special", 80), price: Math.round(price * 100) / 100, mode, startDate, endDate,
    active: body.active !== false, priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
    desktopPoster, mobilePoster,
    predefinedItems, selectableItems, requiredSelectionCount: mode === "selectable" ? requiredSelectionCount : 0
  };
};

export const listDiscounts = asyncHandler(async (_req, res) => {
  const discounts = await ProductDiscount.find().populate("product", "name price unit image active").sort({ endDate: -1, createdAt: -1 }).lean();
  const now = new Date();
  res.json(discounts.map((discount) => ({ ...discount, discountedPrice: discount.product ? discountPriceFor(discount.product, discount) : 0, status: !discount.active ? "disabled" : new Date(discount.endDate) <= now ? "expired" : new Date(discount.startDate) > now ? "upcoming" : "active" })));
});

export const createDiscounts = asyncHandler(async (req, res) => {
  const productIds = Array.isArray(req.body.productIds) ? req.body.productIds : [];
  if (!productIds.length || !productIds.every(validId)) throw fail("Select at least one valid product");
  const percentage = Number(req.body.percentage);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) throw fail("Discount percentage must be between 0 and 100");
  const startDate = asDate(req.body.startDate, "Start date");
  const endDate = asDate(req.body.endDate, "End date");
  if (endDate <= startDate) throw fail("End date must be after start date");
  const products = await Product.find({ _id: { $in: productIds } }).select("_id");
  if (products.length !== new Set(productIds.map(String)).size) throw fail("One or more selected products do not exist");
  const overlap = await ProductDiscount.exists({ product: { $in: productIds }, active: true, startDate: { $lt: endDate }, endDate: { $gt: startDate } });
  if (overlap) throw fail("A selected product already has an overlapping active discount");
  const created = await ProductDiscount.insertMany(productIds.map((product) => ({ product, percentage, startDate, endDate, active: req.body.active !== false })));
  res.status(201).json(created);
});

export const updateDiscount = asyncHandler(async (req, res) => {
  const discount = await ProductDiscount.findById(req.params.id);
  if (!discount) throw fail("Discount not found", 404);
  const percentage = req.body.percentage === undefined ? discount.percentage : Number(req.body.percentage);
  const startDate = req.body.startDate === undefined ? discount.startDate : asDate(req.body.startDate, "Start date");
  const endDate = req.body.endDate === undefined ? discount.endDate : asDate(req.body.endDate, "End date");
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100 || endDate <= startDate) throw fail("Check the discount percentage and date range");
  const active = req.body.active === undefined ? discount.active : Boolean(req.body.active);
  const overlap = active && await ProductDiscount.exists({ _id: { $ne: discount._id }, product: discount.product, active: true, startDate: { $lt: endDate }, endDate: { $gt: startDate } });
  if (overlap) throw fail("This product already has an overlapping active discount");
  Object.assign(discount, { percentage, startDate, endDate, active });
  res.json(await discount.save());
});

export const deleteDiscount = asyncHandler(async (req, res) => {
  const discount = await ProductDiscount.findByIdAndDelete(req.params.id);
  if (!discount) throw fail("Discount not found", 404);
  res.json({ message: "Discount removed" });
});

export const listGiftBoxes = asyncHandler(async (req, res) => {
  const now = new Date();
  const query = req.query.active === "true" ? { active: true, startDate: { $lte: now }, endDate: { $gt: now } } : {};
  const giftBoxes = await GiftBox.find(query).sort({ priority: -1, startDate: 1 }).lean();
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(giftBoxes.map(publicGiftBox));
});

export const listActiveGiftBoxes = asyncHandler(async (_req, res) => {
  const now = new Date();
  const giftBoxes = await GiftBox.find({ active: true, startDate: { $lte: now }, endDate: { $gt: now } })
    .sort({ priority: -1, startDate: 1 })
    .lean();
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(giftBoxes.map(publicGiftBox));
});

export const getGiftBox = asyncHandler(async (req, res) => {
  const giftBox = await GiftBox.findOne({ slug: req.params.slug }).lean();
  if (!giftBox) throw fail("Gift box not found", 404);
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(publicGiftBox(giftBox));
});

export const listAdminGiftBoxes = asyncHandler(async (_req, res) => {
  const giftBoxes = await GiftBox.find().sort({ createdAt: -1 }).lean();
  res.json(giftBoxes.map(giftBoxWithStatus));
});

export const createGiftBox = asyncHandler(async (req, res) => {
  const giftBox = await GiftBox.create(await sanitizeGiftBox(req.body));
  res.status(201).json(giftBoxWithStatus(giftBox));
});

export const updateGiftBox = asyncHandler(async (req, res) => {
  const giftBox = await GiftBox.findById(req.params.id);
  if (!giftBox) throw fail("Gift box not found", 404);
  Object.assign(giftBox, await sanitizeGiftBox({ ...giftBox.toObject(), ...req.body }, giftBox));
  res.json(giftBoxWithStatus(await giftBox.save()));
});

export const toggleGiftBox = asyncHandler(async (req, res) => {
  const giftBox = await GiftBox.findById(req.params.id);
  if (!giftBox) throw fail("Gift box not found", 404);
  giftBox.active = req.body.active === undefined ? !giftBox.active : Boolean(req.body.active);
  res.json(giftBoxWithStatus(await giftBox.save()));
});

export const duplicateGiftBox = asyncHandler(async (req, res) => {
  const source = await GiftBox.findById(req.params.id).lean();
  if (!source) throw fail("Gift box not found", 404);
  const copy = await GiftBox.create({ ...source, _id: undefined, name: `${source.name} copy`, slug: `${source.slug}-copy-${Date.now().toString(36)}`, active: false, createdAt: undefined, updatedAt: undefined });
  res.status(201).json(giftBoxWithStatus(copy));
});

export const deleteGiftBox = asyncHandler(async (req, res) => {
  const giftBox = await GiftBox.findByIdAndDelete(req.params.id);
  if (!giftBox) throw fail("Gift box not found", 404);
  res.json({ message: "Gift box deleted" });
});

export { giftBoxState };
