import asyncHandler from "express-async-handler";
import Category from "../models/Category.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { ensureCategory } from "../utils/categoryRegistry.js";
import slugify from "../utils/slugify.js";
import { decorateProductsWithDiscounts } from "../utils/catalogPricing.js";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 2 * 1024 * 1024;
const cleanText = (value, max = 500) => String(value || "").trim().slice(0, max);
const validationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSpecs = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .slice(0, 24)
    .map((spec) => ({
      label: cleanText(spec?.label, 60),
      value: cleanText(spec?.value, 160)
    }))
    .filter((spec) => {
      if (!spec.label || !spec.value) return false;
      const key = spec.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const validateDataImage = (image = "") => {
  const value = String(image || "");
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value.slice(0, 1200);
  const match = value.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) validationError("Product image must be a valid image file");
  const type = match[1].toLowerCase();
  if (!allowedImageTypes.has(type)) validationError("Product image must be JPG, PNG, or WEBP");
  if (Buffer.byteLength(match[2], "base64") > maxImageBytes) validationError("Product image must be smaller than 2MB");
  return value;
};

const normalizeProductPayload = (payload) => {
  const update = {};
  if (payload.name !== undefined) update.name = cleanText(payload.name, 120);
  if (payload.slug !== undefined) update.slug = cleanText(payload.slug, 140);
  if (payload.category !== undefined) update.category = cleanText(payload.category, 80);
  if (payload.subcategory !== undefined) update.subcategory = cleanText(payload.subcategory, 60);
  if (payload.brand !== undefined) update.brand = cleanText(payload.brand, 60);
  if (payload.description !== undefined) update.description = cleanText(payload.description, 600);
  if (payload.specs !== undefined) update.specs = normalizeSpecs(payload.specs);
  if (payload.unit !== undefined) update.unit = cleanText(payload.unit, 30);
  if (payload.emoji !== undefined) update.emoji = cleanText(payload.emoji, 20);
  if (payload.color !== undefined) update.color = /^#[0-9a-f]{6}$/i.test(String(payload.color)) ? payload.color : "#b87445";
  if (payload.image !== undefined) update.image = validateDataImage(payload.image);
  if (payload.price !== undefined) update.price = Math.max(0, Number(payload.price) || 0);
  if (payload.discountPrice !== undefined) update.discountPrice = Math.max(0, Number(payload.discountPrice) || 0);
  if (payload.stock !== undefined) update.stock = Math.max(0, Math.floor(Number(payload.stock) || 0));
  if (payload.featured !== undefined) update.featured = Boolean(payload.featured);
  if (payload.newArrival !== undefined) update.newArrival = Boolean(payload.newArrival);
  if (payload.bestSeller !== undefined) update.bestSeller = Boolean(payload.bestSeller);
  if (payload.showOnShop !== undefined) update.showOnShop = Boolean(payload.showOnShop);
  if (payload.active !== undefined) update.active = Boolean(payload.active);
  return update;
};

export const listProducts = asyncHandler(async (req, res) => {
  const query = { active: true, showOnShop: { $ne: false } };
  if (req.query.category && req.query.category !== "All") {
    query.category = { $regex: `^${escapeRegExp(cleanText(req.query.category, 80))}$`, $options: "i" };
  }
  if (req.query.subcategory && req.query.subcategory !== "All") {
    query.subcategory = { $regex: `^${escapeRegExp(cleanText(req.query.subcategory, 60))}$`, $options: "i" };
  }
  if (req.query.featured === "true") query.featured = true;
  if (req.query.section === "new") query.newArrival = true;
  if (req.query.section === "best") query.bestSeller = true;
  if (req.query.search) {
    const term = escapeRegExp(cleanText(req.query.search, 120));
    query.$or = [
      { name: { $regex: term, $options: "i" } },
      { description: { $regex: term, $options: "i" } },
      { category: { $regex: term, $options: "i" } },
      { subcategory: { $regex: term, $options: "i" } },
      { brand: { $regex: term, $options: "i" } },
      { "specs.value": { $regex: term, $options: "i" } }
    ];
  }
  const limit = Math.min(80, Math.max(0, Number(req.query.limit) || 0));
  let products = Product.find(query)
    // Production cost is internal business data and must never reach the
    // public storefront payload.
    .select("-reviews -productionCost")
    .sort({ featured: -1, createdAt: -1 })
    .lean();
  if (limit) products = products.limit(limit);
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(await decorateProductsWithDiscounts(await products));
});

export const listProductCategories = asyncHandler(async (_req, res) => {
  const [registered, used] = await Promise.all([
    Category.find({ active: true }).sort({ order: 1, name: 1 }).lean(),
    Product.distinct("category", { active: true, showOnShop: { $ne: false } })
  ]);
  const names = new Set(registered.map((category) => category.name).filter(Boolean));
  used.filter(Boolean).forEach((name) => names.add(String(name)));
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
  res.json([...names].sort((a, b) => a.localeCompare(b)));
});

export const listAdminProducts = asyncHandler(async (_req, res) => {
  res.json(await Product.find().sort({ createdAt: -1 }));
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, active: true, showOnShop: { $ne: false } }).select("-productionCost").lean();
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  product.reviews = (product.reviews || []).filter((review) => review.approved);
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json((await decorateProductsWithDiscounts([product]))[0]);
});

export const addProductReview = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, active: true, showOnShop: { $ne: false } });
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  const { name, email = "", rating, title, comment } = req.body;
  if (!name || !rating || !title || !comment) {
    res.status(400);
    throw new Error("Name, rating, title, and review are required");
  }
  const parsedRating = Number(rating);
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    res.status(400);
    throw new Error("Rating must be between 1 and 5");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    res.status(400);
    throw new Error("Enter a valid email address");
  }
  product.reviews.unshift({
    name: cleanText(name, 80),
    email: cleanText(email, 160).toLowerCase(),
    rating: parsedRating,
    title: cleanText(title, 120),
    comment: cleanText(comment, 1200),
    approved: false
  });
  await product.save();
  const safeProduct = product.toObject();
  safeProduct.reviews = (safeProduct.reviews || []).filter((review) => review.approved);
  res.status(201).json(safeProduct);
});

export const createProduct = asyncHandler(async (req, res) => {
  const slug = slugify(req.body.slug || req.body.name || "");
  if (!slug) {
    res.status(400);
    throw new Error("A valid product name is required");
  }
  if (await Product.exists({ slug })) {
    res.status(409);
    throw new Error("A product with this slug already exists");
  }
  const product = await Product.create({ ...normalizeProductPayload(req.body), slug });
  await ensureCategory(product.category);
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  const update = normalizeProductPayload(req.body);
  if (update.name || update.slug) update.slug = slugify(update.slug || update.name);
  Object.assign(product, update);
  const savedProduct = await product.save();
  await ensureCategory(savedProduct.category);
  res.json(savedProduct);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  product.active = false;
  await product.save();
  res.json({ message: "Product archived" });
});

export const hardDeleteProduct = asyncHandler(async (req, res) => {
  const orderCount = await Order.countDocuments({ "items.product": req.params.id, deletedAt: { $exists: false } });
  if (orderCount > 0) {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404);
      throw new Error("Product not found");
    }
    product.active = false;
    await product.save();
    return res.json({ message: "Product is used in orders, so it was archived instead of permanently deleted" });
  }
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  res.json({ message: "Product deleted permanently" });
});

export const deleteProductReview = asyncHandler(async (req, res) => {
  const { productId, reviewId } = req.params;
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  const reviewIndex = product.reviews.findIndex((r) => String(r._id) === reviewId);
  if (reviewIndex === -1) {
    res.status(404);
    throw new Error("Review not found");
  }
  product.reviews.splice(reviewIndex, 1);
  await product.save();
  res.json({ message: "Review deleted successfully" });
});

export const updateProductReviewStatus = asyncHandler(async (req, res) => {
  const { productId, reviewId } = req.params;
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }
  const review = product.reviews.id(reviewId);
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }
  review.approved = Boolean(req.body.approved);
  await product.save();
  res.json({ message: review.approved ? "Review approved" : "Review hidden", review });
});
