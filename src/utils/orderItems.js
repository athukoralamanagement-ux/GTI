import mongoose from "mongoose";
import GiftBox from "../models/GiftBox.js";
import Product from "../models/Product.js";
import { activeDiscountQuery, discountPriceFor, getLegacySalePrice } from "./catalogPricing.js";
import { findBuildPart } from "../data/buildParts.js";

const objectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const error = (message) => Object.assign(new Error(message), { statusCode: 400 });
const cleanText = (value, max = 120) => String(value || "").trim().slice(0, max);
const parseGrams = (unit = "") => {
  const match = String(unit).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|g)/);
  return !match ? 0 : Number(match[1]) * (match[2] === "kg" ? 1000 : 1);
};
const packMultiplier = (selected, base) => {
  const selectedGrams = parseGrams(selected);
  const baseGrams = parseGrams(base);
  if (!selectedGrams || !baseGrams) return 1;
  const ratio = selectedGrams / baseGrams;
  if (selectedGrams < baseGrams || Math.abs(ratio - Math.round(ratio)) > 0.001) return 0;
  return Math.max(1, Math.round(ratio));
};
const activeGiftBox = (giftBox, now = new Date()) => giftBox && giftBox.active && new Date(giftBox.startDate) <= now && new Date(giftBox.endDate) > now;
const snapshotItem = (item) => ({ id: String(item._id), name: item.name, productType: item.productType, weight: item.weight, unit: item.unit, quantity: item.quantity, image: item.image, inventoryProduct: item.inventoryProduct || null, inventoryQuantity: item.inventoryQuantity || 0 });

export const buildAuthoritativeOrderItems = async (rawItems, { session, includeHiddenProducts = false } = {}) => {
  if (!Array.isArray(rawItems) || !rawItems.length) throw error("Your cart is empty");
  const buildInputs = rawItems.filter((item) => item?.type === "build-part");
  const customBuildInputs = rawItems.filter((item) => item?.type === "custom-build");
  const productInputs = rawItems.filter((item) => !["gift-box", "build-part", "custom-build"].includes(item?.type));
  const giftInputs = rawItems.filter((item) => item?.type === "gift-box");
  if (!productInputs.every((item) => objectId(item.product)) || !giftInputs.every((item) => objectId(item.giftBox))) throw error("One or more cart items are invalid");

  const productIds = [...new Set(productInputs.map((item) => String(item.product)))];
  const giftIds = [...new Set(giftInputs.map((item) => String(item.giftBox)))];
  const withSession = (query) => session ? query.session(session) : query;
  const [products, giftBoxes, activeDiscounts] = await Promise.all([
    productIds.length ? withSession(Product.find({ _id: { $in: productIds }, active: true, ...(includeHiddenProducts ? {} : { showOnShop: { $ne: false } }) })) : [],
    giftIds.length ? withSession(GiftBox.find({ _id: { $in: giftIds } })) : [],
    productIds.length ? withSession(activeDiscountQuery(productIds)) : []
  ]);
  if (products.length !== productIds.length || giftBoxes.length !== giftIds.length) throw error("One or more selected products are unavailable");
  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const discountMap = new Map(activeDiscounts.map((discount) => [String(discount.product), discount]));
  const giftBoxMap = new Map(giftBoxes.map((giftBox) => [String(giftBox._id), giftBox]));
  const stockRequested = new Map();
  const items = [];

  for (const input of productInputs) {
    const product = productMap.get(String(input.product));
    const quantity = Number(input.quantity);
    const unit = input.unit || product.unit;
    const multiplier = packMultiplier(unit, product.unit);
    const stockQuantity = quantity * multiplier;
    if (!Number.isInteger(quantity) || quantity < 1 || !multiplier || stockQuantity > product.stock) throw error(`${product.name} does not have enough stock`);
    stockRequested.set(String(product._id), (stockRequested.get(String(product._id)) || 0) + stockQuantity);
    const discounted = discountMap.get(String(product._id));
    const price = discounted ? discountPriceFor(product, discounted) : getLegacySalePrice(product);
    items.push({ kind: "product", product: product._id, name: product.name, price: Math.round(price * multiplier * 100) / 100, costPrice: Math.round((Number(product.productionCost) || 0) * multiplier * 100) / 100, unit, quantity, stockQuantity });
  }

  // Custom PC builder components are not inventory products. Their price is
  // always taken from the server-side parts catalog, never from the client.
  for (const input of buildInputs) {
    const part = findBuildPart(input.partId || input.product);
    if (!part) throw error("One or more custom build components are unavailable");
    const quantity = Number(input.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw error(`Quantity for ${part.name} is invalid`);
    items.push({
      kind: "build-part",
      partId: part._id,
      name: part.name,
      price: Number(part.price) || 0,
      costPrice: 0,
      unit: part.categoryLabel || "Custom PC component",
      quantity,
      stockQuantity: 0,
      buildSnapshot: {
        category: part.categoryLabel || "",
        brand: part.brand || "",
        warranty: part.warranty || "",
        image: part.image || ""
      }
    });
  }

  // A full Build My PC configuration is checked out as ONE cart line. The
  // component list is snapshotted for fulfilment, but the customer sees a
  // single "complete custom PC" item.
  for (const input of customBuildInputs) {
    const rawParts = Array.isArray(input.parts) ? input.parts : [];
    const partIds = [...new Set(rawParts.map((entry) => String(entry?.partId || entry || "")).filter(Boolean))];
    if (!partIds.length) throw error("Your custom PC build has no components");
    if (partIds.length > 16) throw error("Your custom PC build has too many components");
    const parts = partIds.map((id) => findBuildPart(id));
    if (parts.some((part) => !part)) throw error("One or more custom build components are unavailable");
    const quantity = Number(input.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw error("Custom PC build quantity is invalid");

    const shortName = (value = "") => String(value).replace(/\([^)]*\)/g, "").split(/[,–-]/)[0].trim().slice(0, 60);
    const cpu = parts.find((part) => part.categoryId === "cpu");
    const gpu = parts.find((part) => part.categoryId === "gpu");
    const name = `Custom PC Build${cpu ? ` — ${shortName(cpu.name)}` : ""}${gpu ? ` + ${shortName(gpu.name)}` : ""}`;
    const price = parts.reduce((sum, part) => sum + (Number(part.price) || 0), 0);
    items.push({
      kind: "custom-build",
      name,
      price,
      costPrice: 0,
      unit: "Complete custom PC",
      quantity,
      stockQuantity: 0,
      buildSnapshot: {
        name: cleanText(input.name, 120) || name,
        template: cleanText(input.template, 120),
        parts: parts.map((part) => ({
          partId: part._id,
          name: part.name,
          price: Number(part.price) || 0,
          category: part.categoryLabel || "",
          brand: part.brand || "",
          warranty: part.warranty || "",
          image: part.image || ""
        }))
      }
    });
  }

  for (const input of giftInputs) {
    const giftBox = giftBoxMap.get(String(input.giftBox));
    if (!activeGiftBox(giftBox)) throw error(`${giftBox?.name || "This gift box"} is no longer available`);
    const quantity = Number(input.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw error("Gift box quantity is invalid");
    let selected = [];
    if (giftBox.mode === "selectable") {
      const selectedIds = Array.isArray(input.selectedItemIds) ? input.selectedItemIds.map(String) : [];
      if (selectedIds.length !== giftBox.requiredSelectionCount || new Set(selectedIds).size !== selectedIds.length) throw error(`Select exactly ${giftBox.requiredSelectionCount} different items for ${giftBox.name}`);
      selected = giftBox.selectableItems.filter((item) => selectedIds.includes(String(item._id)));
      if (selected.length !== selectedIds.length) throw error("One or more gift box choices are invalid");
    } else selected = giftBox.predefinedItems;
    const inventoryAllocations = selected.filter((item) => item.inventoryProduct && Number(item.inventoryQuantity) > 0).map((item) => ({ product: item.inventoryProduct, quantity: Number(item.inventoryQuantity) * quantity }));
    for (const allocation of inventoryAllocations) stockRequested.set(String(allocation.product), (stockRequested.get(String(allocation.product)) || 0) + allocation.quantity);
    const allocationProducts = inventoryAllocations.length ? await withSession(Product.find({ _id: { $in: inventoryAllocations.map((allocation) => allocation.product) } }).select("productionCost")) : [];
    const allocationCosts = new Map(allocationProducts.map((product) => [String(product._id), Number(product.productionCost) || 0]));
    const giftCost = inventoryAllocations.reduce((sum, allocation) => sum + (allocationCosts.get(String(allocation.product)) || 0) * Number(allocation.quantity || 0), 0);
    items.push({ kind: "gift-box", giftBox: giftBox._id, name: giftBox.name, price: Number(giftBox.price), costPrice: Math.round((giftCost / quantity) * 100) / 100, unit: "Gift box", quantity, stockQuantity: 0, giftBoxSnapshot: { name: giftBox.name, mode: giftBox.mode, occasion: giftBox.occasion, price: giftBox.price, selectedItems: selected.map(snapshotItem), requiredSelectionCount: giftBox.requiredSelectionCount }, inventoryAllocations });
  }

  for (const [id, quantity] of stockRequested) {
    const product = productMap.get(id) || await withSession(Product.findById(id));
    if (!product || Number(product.stock) < quantity) throw error(`${product?.name || "A gift box item"} does not have enough stock`);
  }
  return { items, productMap, stockRequested };
};

export const inventoryAllocationsFor = (orderLike) => {
  const allocations = new Map();
  for (const item of orderLike.items || []) {
    if (item.kind === "gift-box") {
      for (const allocation of item.inventoryAllocations || []) allocations.set(String(allocation.product), (allocations.get(String(allocation.product)) || 0) + Number(allocation.quantity || 0));
    } else if (item.product) allocations.set(String(item.product), (allocations.get(String(item.product)) || 0) + Number(item.stockQuantity || item.quantity || 0));
  }
  return [...allocations.entries()].filter(([, quantity]) => quantity > 0).map(([product, quantity]) => ({ product, quantity }));
};
