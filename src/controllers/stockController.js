import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockItem from "../models/StockItem.js";
import StockTransfer from "../models/StockTransfer.js";

const clean = (value, max = 500) => String(value || "").trim().slice(0, max);
const bad = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const validId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const positive = (value, label) => { const number = Number(value); if (!Number.isFinite(number) || number <= 0) throw bad(`${label} must be greater than zero`); return number; };
const nonNegative = (value, label) => { const number = Number(value); if (!Number.isFinite(number) || number < 0) throw bad(`${label} cannot be negative`); return number; };
const types = new Set(["raw", "packaging"]);
const rawUnit = (value) => {
  const unit = clean(value || "kg", 10).toLowerCase();
  if (!new Set(["kg", "g"]).has(unit)) throw bad("Raw material unit must be kg or g");
  return unit;
};

const serializeItem = (item) => ({ ...item.toObject(), displayQuantity: item.type === "raw" ? item.quantity / 1000 : item.quantity, displayUnit: item.type === "raw" ? "kg" : item.unit });

const restoreTransferInventory = async (transfer, session) => {
  if (transfer.finishedProduct) {
    const result = await Product.updateOne(
      { _id: transfer.finishedProduct, stock: { $gte: transfer.packCount } },
      { $inc: { stock: -transfer.packCount } },
      { session }
    );
    if (!result.modifiedCount) throw bad("This transfer cannot be changed because its finished packs have already been sold or used", 409);
  }
  await StockItem.updateOne({ _id: transfer.rawMaterial, type: "raw" }, { $inc: { quantity: transfer.rawWeightUsedGrams } }, { session });
  await Promise.all((transfer.packagingMaterials || []).map((material) => StockItem.updateOne(
    { _id: material.item, type: "packaging" },
    { $inc: { quantity: material.quantity } },
    { session }
  )));
};

const transferInput = (body) => {
  const { rawMaterial, finishedProduct, packSizeGrams, packCount, packagingMaterials = [], note = "" } = body;
  if (!validId(rawMaterial)) throw bad("Choose a valid raw material");
  if (!validId(finishedProduct)) throw bad("Choose a valid finished product");
  const grams = positive(packSizeGrams, "Pack size");
  const packs = positive(packCount, "Pack count");
  if (!Number.isInteger(packs)) throw bad("Pack count must be a whole number");
  if (!Array.isArray(packagingMaterials) || !packagingMaterials.length) throw bad("Select at least one packaging material");
  if (!packagingMaterials.every((material) => validId(material.item) && positive(material.perPack, "Packaging quantity"))) throw bad("Packaging materials are invalid");
  const mergedMaterials = new Map();
  packagingMaterials.forEach((material) => mergedMaterials.set(String(material.item), (mergedMaterials.get(String(material.item)) || 0) + Number(material.perPack) * packs));
  return { rawMaterial, finishedProduct, grams, packs, mergedMaterials, note: clean(note, 500) };
};

const applyTransferInventory = async ({ input, session, transfer, createdBy, idempotencyKey }) => {
  const materialIds = [...input.mergedMaterials.keys()];
  const [raw, materials, product] = await Promise.all([
    StockItem.findOne({ _id: input.rawMaterial, type: "raw" }).session(session),
    StockItem.find({ _id: { $in: materialIds }, type: "packaging" }).session(session),
    Product.findById(input.finishedProduct).session(session)
  ]);
  if (!raw || materials.length !== materialIds.length) throw bad("One or more stock materials are unavailable");
  if (!product) throw bad("Finished product was not found");
  const rawUsed = input.grams * input.packs;
  if (raw.quantity < rawUsed) throw bad(`Insufficient ${raw.name} stock`);
  const byId = new Map(materials.map((item) => [String(item._id), item]));
  for (const [id, quantity] of input.mergedMaterials) if (byId.get(id).quantity < quantity) throw bad(`Insufficient ${byId.get(id).name} stock`);
  if (!(await StockItem.updateOne({ _id: raw._id, quantity: { $gte: rawUsed } }, { $inc: { quantity: -rawUsed } }, { session })).modifiedCount) throw bad("Raw material stock changed. Please try again.");
  for (const [id, quantity] of input.mergedMaterials) if (!(await StockItem.updateOne({ _id: id, quantity: { $gte: quantity } }, { $inc: { quantity: -quantity } }, { session })).modifiedCount) throw bad("Packaging stock changed. Please try again.");
  const rawMaterialCost = rawUsed * Number(raw.unitCost || 0);
  const packagingSnapshots = [...input.mergedMaterials].map(([id, quantity]) => { const material = byId.get(id); const unitCost = Number(material.unitCost || 0); return { item: id, name: material.name, quantity, unit: material.unit, unitCost, totalCost: quantity * unitCost }; });
  const totalProductionCost = rawMaterialCost + packagingSnapshots.reduce((sum, material) => sum + material.totalCost, 0);
  const costPerPack = totalProductionCost / input.packs;
  const previousCost = Number(product.productionCost) > 0 ? Number(product.productionCost) : costPerPack;
  const nextCost = ((Number(product.stock) * previousCost) + (input.packs * costPerPack)) / (Number(product.stock) + input.packs);
  await Product.updateOne({ _id: product._id }, { $inc: { stock: input.packs }, $set: { productionCost: nextCost } }, { session });
  const data = { rawMaterial: raw._id, rawMaterialName: raw.name, finishedProduct: product._id, finishedProductName: product.name, packSizeGrams: input.grams, packCount: input.packs, rawWeightUsedGrams: rawUsed, rawMaterialUnitCost: Number(raw.unitCost || 0), rawMaterialCost, packagingMaterials: packagingSnapshots, totalProductionCost, costPerPack, note: input.note };
  if (transfer) return StockTransfer.findByIdAndUpdate(transfer._id, { $set: data }, { new: true, session });
  return StockTransfer.create([{ ...data, idempotencyKey, createdBy }], { session }).then(([created]) => created);
};

export const listStock = asyncHandler(async (_req, res) => {
  const [items, transfers] = await Promise.all([
    StockItem.find().sort({ type: 1, name: 1 }),
    StockTransfer.find().sort({ createdAt: -1 }).limit(60).populate("finishedProduct", "name unit").populate("createdBy", "name")
  ]);
  res.json({ items: items.map(serializeItem), transfers });
});

export const createStockItem = asyncHandler(async (req, res) => {
  const type = clean(req.body.type, 20);
  const name = clean(req.body.name, 120);
  if (!types.has(type) || !name) throw bad("Stock type and name are required");
  const inputQuantity = positive(req.body.quantity, "Quantity");
  const inputUnit = type === "raw" ? rawUnit(req.body.unit) : clean(req.body.unit || "pieces", 20);
  if (!inputUnit) throw bad("A stock unit is required");
  const unit = type === "raw" ? "g" : inputUnit;
  const quantity = type === "raw" ? inputQuantity * (inputUnit === "g" ? 1 : 1000) : inputQuantity;
  const purchaseCost = nonNegative(req.body.purchaseCost, "Purchase cost");
  let item;
  try {
    item = await StockItem.create({ name, type, quantity, unit, unitCost: purchaseCost / quantity, lastPurchaseCost: purchaseCost, notes: clean(req.body.notes, 500) });
  } catch (error) {
    if (error?.code === 11000) throw bad("A stock item with this name already exists");
    throw error;
  }
  res.status(201).json(serializeItem(item));
});

export const updateStockItem = asyncHandler(async (req, res) => {
  const item = await StockItem.findById(req.params.id);
  if (!item) throw bad("Stock item not found", 404);
  if (req.body.name !== undefined) {
    const name = clean(req.body.name, 120);
    if (!name) throw bad("Stock item name is required");
    item.name = name;
  }
  if (req.body.notes !== undefined) item.notes = clean(req.body.notes, 500);
  if (item.type === "packaging" && req.body.unit !== undefined) {
    const unit = clean(req.body.unit, 20);
    if (!unit) throw bad("A stock unit is required");
    item.unit = unit;
  }
  if (req.body.quantity !== undefined) {
    const value = Number(req.body.quantity);
    if (!Number.isFinite(value) || value < 0) throw bad("Quantity cannot be negative");
    item.quantity = item.type === "raw" ? value * (rawUnit(req.body.unit) === "g" ? 1 : 1000) : value;
  }
  if (req.body.purchaseCost !== undefined) {
    const purchaseCost = nonNegative(req.body.purchaseCost, "Purchase cost");
    if (item.quantity <= 0 && purchaseCost > 0) throw bad("Quantity must be greater than zero when setting a purchase cost");
    item.unitCost = item.quantity > 0 ? purchaseCost / item.quantity : 0;
    item.lastPurchaseCost = purchaseCost;
  }
  try {
    res.json(serializeItem(await item.save()));
  } catch (error) {
    if (error?.code === 11000) throw bad("A stock item with this name already exists");
    throw error;
  }
});

export const adjustStockItem = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount === 0) throw bad("Enter a non-zero adjustment");
  const item = await StockItem.findById(req.params.id);
  if (!item) throw bad("Stock item not found", 404);
  const delta = item.type === "raw" ? amount * (rawUnit(req.body.unit) === "g" ? 1 : 1000) : amount;
  const purchaseCost = req.body.purchaseCost === undefined ? 0 : nonNegative(req.body.purchaseCost, "Purchase cost");
  if (delta < 0 && purchaseCost > 0) throw bad("Purchase cost can only be entered when adding stock");
  const nextQuantity = item.quantity + delta;
  if (nextQuantity < 0) throw bad("This adjustment would make stock negative");
  const nextUnitCost = delta > 0 ? ((item.quantity * item.unitCost) + purchaseCost) / nextQuantity : item.unitCost;
  const updated = await StockItem.findOneAndUpdate(
    { _id: item._id, quantity: item.quantity },
    { $set: { quantity: nextQuantity, unitCost: nextUnitCost, lastPurchaseCost: delta > 0 ? purchaseCost : item.lastPurchaseCost } },
    { new: true }
  );
  if (!updated) throw bad("This adjustment would make stock negative");
  res.json(serializeItem(updated));
});

export const deleteStockItem = asyncHandler(async (req, res) => {
  const used = await StockTransfer.exists({ $or: [{ rawMaterial: req.params.id }, { "packagingMaterials.item": req.params.id }] });
  if (used) throw bad("This stock item is used in transfer history and cannot be deleted", 409);
  const item = await StockItem.findByIdAndDelete(req.params.id);
  if (!item) throw bad("Stock item not found", 404);
  res.json({ message: "Stock item deleted" });
});

export const deleteTransfer = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findById(req.params.id).session(session);
      if (!transfer) throw bad("Transfer record not found", 404);
      await restoreTransferInventory(transfer, session);
      await StockTransfer.deleteOne({ _id: transfer._id }, { session });
    });
    res.json({ message: "Transfer deleted and stock restored" });
  } catch (error) {
    if (/Transaction numbers are only allowed|replica set/i.test(error.message || "")) throw bad("Stock transfers require MongoDB replica-set transactions.", 503);
    throw error;
  } finally { await session.endSession(); }
});

export const updateTransfer = asyncHandler(async (req, res) => {
  const input = transferInput(req.body);
  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findById(req.params.id).session(session);
      if (!transfer) throw bad("Transfer record not found", 404);
      await restoreTransferInventory(transfer, session);
      updated = await applyTransferInventory({ input, session, transfer });
    });
    res.json(updated);
  } catch (error) {
    if (/Transaction numbers are only allowed|replica set/i.test(error.message || "")) throw bad("Stock transfers require MongoDB replica-set transactions.", 503);
    throw error;
  } finally { await session.endSession(); }
});

export const createTransfer = asyncHandler(async (req, res) => {
  const input = transferInput(req.body);
  const idempotencyKey = clean(req.get("Idempotency-Key"), 100);
  if (!idempotencyKey || idempotencyKey.length < 12) throw bad("A valid transfer request key is required");
  const existing = await StockTransfer.findOne({ createdBy: req.user._id, idempotencyKey });
  if (existing) return res.status(200).json(existing);
  const session = await mongoose.startSession();
  try {
    let transfer;
    await session.withTransaction(async () => {
      transfer = await applyTransferInventory({ input, session, createdBy: req.user._id, idempotencyKey });
    });
    res.status(201).json(transfer);
  } catch (error) {
    // Transfers must never partially deduct stock. A production database needs
    // MongoDB transactions (Atlas/replica set) for this operation.
    if (/Transaction numbers are only allowed|replica set/i.test(error.message || "")) {
      throw bad("Stock transfers require MongoDB replica-set transactions. Configure a replica set before production use.", 503);
    }
    if (error?.code === 11000) {
      const processed = await StockTransfer.findOne({ createdBy: req.user._id, idempotencyKey });
      if (processed) return res.status(200).json(processed);
    }
    throw error;
  } finally { await session.endSession(); }
});
