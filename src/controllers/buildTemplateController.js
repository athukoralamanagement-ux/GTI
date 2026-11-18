import asyncHandler from "express-async-handler";
import BuildTemplate from "../models/BuildTemplate.js";
import { findBuildPart } from "../data/buildParts.js";
import slugify from "../utils/slugify.js";

const fail = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const cleanText = (value, max = 300) => String(value || "").trim().slice(0, max);

const imageValue = (value) => {
  const image = String(value || "").trim();
  if (!image) return "";
  if (/^https?:\/\//i.test(image) || image.startsWith("/")) return image.slice(0, 1200);
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(image)) return image;
  fail("Template image must be a URL, a local asset path, or a JPG/PNG/WEBP upload");
};

const normalizeParts = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const entry of value.slice(0, 16)) {
    const id = String(entry?.partId || entry || "").trim();
    if (!id || seen.has(id)) continue;
    if (!findBuildPart(id)) fail(`Unknown build component: ${id}`);
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

const priceForParts = (partIds) =>
  partIds.reduce((sum, id) => sum + (Number(findBuildPart(id)?.price) || 0), 0);

const payloadFor = (body, existing = null) => {
  const name = cleanText(body.name ?? existing?.name, 120);
  if (!name) fail("Template name is required");
  const parts = body.parts !== undefined ? normalizeParts(body.parts) : existing?.parts || [];
  if (!parts.length) fail("Choose at least one component for the template");
  const slug = slugify(body.slug || name);
  if (!slug) fail("Template needs a valid name or slug");
  const orderValue = Number(body.order ?? existing?.order);
  return {
    name,
    slug,
    tagline: cleanText(body.tagline ?? existing?.tagline, 160),
    description: cleanText(body.description ?? existing?.description, 800),
    image: body.image !== undefined ? imageValue(body.image) : existing?.image || "",
    badge: cleanText(body.badge ?? existing?.badge, 40),
    parts,
    price: priceForParts(parts),
    order: Number.isFinite(orderValue) ? orderValue : 100,
    featured: body.featured === undefined ? existing?.featured === true : Boolean(body.featured),
    active: body.active === undefined ? existing?.active !== false : Boolean(body.active)
  };
};

const assertUnique = async (payload, ignoreId = null) => {
  if (await BuildTemplate.exists({ _id: { $ne: ignoreId }, slug: payload.slug })) {
    fail("A pre-built template with this name already exists", 409);
  }
};

const present = (template) => {
  const plain = typeof template.toObject === "function" ? template.toObject() : template;
  return {
    ...plain,
    parts: (plain.parts || []).map((partId) => {
      const part = findBuildPart(partId);
      return part
        ? { partId, name: part.name, price: part.price, categoryId: part.categoryId, categoryLabel: part.categoryLabel, brand: part.brand, image: part.image, warranty: part.warranty }
        : { partId, name: "Unavailable component", price: 0 };
    })
  };
};

export const listBuildTemplates = asyncHandler(async (_req, res) => {
  const templates = await BuildTemplate.find({ active: true }).sort({ featured: -1, order: 1, name: 1 }).lean();
  res.set("Cache-Control", "no-cache");
  res.json(templates.map(present));
});

export const listAdminBuildTemplates = asyncHandler(async (_req, res) => {
  const templates = await BuildTemplate.find().sort({ order: 1, name: 1 }).lean();
  res.json(templates.map(present));
});

export const getBuildTemplate = asyncHandler(async (req, res) => {
  const template = await BuildTemplate.findOne({ slug: req.params.slug, active: true }).lean();
  if (!template) fail("Pre-built template not found", 404);
  res.json(present(template));
});

export const createBuildTemplate = asyncHandler(async (req, res) => {
  const payload = payloadFor(req.body);
  await assertUnique(payload);
  const template = await BuildTemplate.create(payload);
  res.status(201).json(present(template));
});

export const updateBuildTemplate = asyncHandler(async (req, res) => {
  const template = await BuildTemplate.findById(req.params.id);
  if (!template) fail("Pre-built template not found", 404);
  const payload = payloadFor(req.body, template);
  await assertUnique(payload, template._id);
  Object.assign(template, payload);
  await template.save();
  res.json(present(template));
});

export const deleteBuildTemplate = asyncHandler(async (req, res) => {
  const template = await BuildTemplate.findById(req.params.id);
  if (!template) fail("Pre-built template not found", 404);
  await template.deleteOne();
  res.json({ message: "Pre-built template deleted" });
});
