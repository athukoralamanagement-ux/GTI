import Category from "../models/Category.js";
import slugify from "./slugify.js";

export const cleanCategoryName = (value = "") => String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);

export const cleanSubcategory = (value = "") => String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);

/** Trim, de-duplicate and cap a subcategory list coming from the admin UI. */
export const cleanSubcategories = (values) => {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const list = [];
  for (const value of values.slice(0, 40)) {
    const clean = cleanSubcategory(value);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(clean);
  }
  return list;
};

/**
 * Make sure a product category is represented in the category registry.
 * Product creation/update uses this so admins can type a new category and it
 * immediately becomes available for navigation, filters and reporting.
 * Existing records are never deleted or renamed by this helper.
 */
export const ensureCategory = async (name) => {
  const cleanName = cleanCategoryName(name);
  const slug = slugify(cleanName);
  if (!cleanName || !slug) return null;

  const existing = await Category.findOne({
    $or: [{ slug }, { name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } }]
  });
  if (existing) return existing;

  try {
    return await Category.create({ name: cleanName, slug, order: 100, subcategories: [] });
  } catch (error) {
    // Two concurrent product saves can race here. The unique slug index wins
    // for one request; return the record the other request created.
    if (error?.code === 11000) return Category.findOne({ slug });
    throw error;
  }
};
