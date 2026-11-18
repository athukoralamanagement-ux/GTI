import asyncHandler from "express-async-handler";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import slugify from "../utils/slugify.js";
import { cleanCategoryName, cleanSubcategories } from "../utils/categoryRegistry.js";

const fail = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const normalizeKey = (value = "") => String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");

const productCounts = async () => {
  const rows = await Product.aggregate([
    { $match: { active: { $ne: false }, showOnShop: { $ne: false } } },
    { $group: { _id: "$category", count: { $sum: 1 } } }
  ]);
  return new Map(rows.filter((row) => row._id).map((row) => [normalizeKey(row._id), { name: row._id, count: row.count }]));
};

const present = (category, count = 0) => ({
  _id: category._id,
  name: category.name,
  slug: category.slug,
  description: category.description || "",
  image: category.image || "",
  subcategories: Array.isArray(category.subcategories) ? category.subcategories : [],
  order: Number(category.order) || 100,
  active: category.active !== false,
  showInNav: category.showInNav !== false,
  productCount: count
});

/**
 * Public category list. Registered categories come first, then any legacy
 * product categories that were saved before the registry existed. This means
 * filters/navigation never silently lose a category because of old data.
 */
export const listCategories = asyncHandler(async (_req, res) => {
  const [registered, counts] = await Promise.all([
    Category.find({ active: true }).sort({ order: 1, name: 1 }).lean(),
    productCounts()
  ]);

  const seen = new Set();
  const categories = registered.map((category) => {
    seen.add(normalizeKey(category.name));
    return present(category, counts.get(normalizeKey(category.name))?.count || 0);
  });

  for (const entry of counts.values()) {
    if (seen.has(normalizeKey(entry.name))) continue;
    const cleanName = cleanCategoryName(entry.name);
    categories.push({
      _id: null,
      name: cleanName,
      slug: slugify(cleanName),
      description: "",
      image: "",
      subcategories: [],
      order: 100,
      active: true,
      showInNav: true,
      productCount: entry.count
    });
  }

  categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  // Category structure drives the site navigation and filters, so it must not
  // outlive an admin create/rename/delete. Express still sends ETags, so repeat
  // visits revalidate cheaply with a 304 instead of refetching the list.
  res.set("Cache-Control", "no-cache");
  res.json(categories);
});

export const listAdminCategories = asyncHandler(async (_req, res) => {
  const [registered, counts] = await Promise.all([
    Category.find().sort({ order: 1, name: 1 }).lean(),
    productCounts()
  ]);
  const seen = new Set();
  const categories = registered.map((category) => {
    seen.add(normalizeKey(category.name));
    return present(category, counts.get(normalizeKey(category.name))?.count || 0);
  });
  for (const entry of counts.values()) {
    if (seen.has(normalizeKey(entry.name))) continue;
    const cleanName = cleanCategoryName(entry.name);
    categories.push({
      _id: null,
      name: cleanName,
      slug: slugify(cleanName),
      description: "",
      image: "",
      subcategories: [],
      order: 100,
      active: true,
      showInNav: true,
      productCount: entry.count,
      legacy: true
    });
  }
  categories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  res.json(categories);
});

const categoryPayload = (body, existing = null) => {
  const name = cleanCategoryName(body.name ?? existing?.name ?? "");
  if (!name) fail("Category name is required");
  const slug = slugify(body.slug || name);
  if (!slug) fail("Category needs a valid name or slug");
  // Explicit [] clears the list; a missing field keeps the existing list so
  // older admin clients cannot wipe it accidentally.
  const subcategories = body.subcategories !== undefined
    ? cleanSubcategories(body.subcategories)
    : (existing && Array.isArray(existing.subcategories) ? existing.subcategories : []);

  return {
    name,
    slug,
    description: String(body.description ?? existing?.description ?? "").trim().slice(0, 300),
    image: String(body.image ?? existing?.image ?? "").slice(0, 1200),
    subcategories,
    order: Number.isFinite(Number(body.order ?? existing?.order)) ? Number(body.order ?? existing?.order) : 100,
    active: body.active === undefined ? existing?.active !== false : Boolean(body.active),
    showInNav: body.showInNav === undefined ? existing?.showInNav !== false : Boolean(body.showInNav)
  };
};

const assertUnique = async (payload, ignoreId = null) => {
  const query = {
    _id: { $ne: ignoreId },
    $or: [
      { slug: payload.slug },
      { name: { $regex: `^${payload.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }
    ]
  };
  if (await Category.exists(query)) fail("A category with this name or slug already exists", 409);
};

export const createCategory = asyncHandler(async (req, res) => {
  const payload = categoryPayload(req.body);
  await assertUnique(payload);
  const category = await Category.create(payload);
  res.status(201).json(present(category, 0));
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) fail("Category not found", 404);

  const previousName = category.name;
  const payload = categoryPayload(req.body, category);
  await assertUnique(payload, category._id);
  Object.assign(category, payload);
  await category.save();

  // Renaming a category must keep every product attached to it.
  if (previousName !== category.name) {
    await Product.updateMany(
      { category: { $regex: `^${previousName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
      { $set: { category: category.name } }
    );
  }

  const count = await Product.countDocuments({
    category: { $regex: `^${category.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    active: { $ne: false },
    showOnShop: { $ne: false }
  });
  res.json(present(category, count));
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) fail("Category not found", 404);

  const productQuery = {
    category: { $regex: `^${category.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  };
  const count = await Product.countDocuments(productQuery);
  const reassignTo = cleanCategoryName(req.query.reassignTo || req.body?.reassignTo || "");

  if (count > 0) {
    if (!reassignTo) {
      fail(`This category still has ${count} product${count === 1 ? "" : "s"}. Move them to another category first.`, 409);
    }
    if (reassignTo.toLowerCase() === category.name.toLowerCase()) {
      fail("Choose a different category to move the products to", 400);
    }
    await Product.updateMany(productQuery, { $set: { category: reassignTo } });
  }

  await category.deleteOne();
  res.json({ message: "Category deleted", movedProducts: count });
});
