import mongoose from "mongoose";

const materialUseSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: "StockItem", required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0.0001 },
  unit: { type: String, required: true },
  unitCost: { type: Number, required: true, min: 0, default: 0 },
  totalCost: { type: Number, required: true, min: 0, default: 0 }
}, { _id: false });

const stockTransferSchema = new mongoose.Schema({
  rawMaterial: { type: mongoose.Schema.Types.ObjectId, ref: "StockItem", required: true },
  rawMaterialName: { type: String, required: true },
  finishedProduct: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  finishedProductName: { type: String, default: "" },
  packSizeGrams: { type: Number, required: true, min: 0.01 },
  packCount: { type: Number, required: true, min: 1 },
  rawWeightUsedGrams: { type: Number, required: true, min: 0.01 },
  rawMaterialUnitCost: { type: Number, required: true, min: 0, default: 0 },
  rawMaterialCost: { type: Number, required: true, min: 0, default: 0 },
  packagingMaterials: { type: [materialUseSchema], default: [] },
  totalProductionCost: { type: Number, required: true, min: 0, default: 0 },
  costPerPack: { type: Number, required: true, min: 0, default: 0 },
  note: { type: String, default: "", trim: true, maxlength: 500 },
  // A client-generated key makes retries and duplicate submits safe.
  idempotencyKey: { type: String, required: true, trim: true, maxlength: 100 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

stockTransferSchema.index({ createdAt: -1 });
stockTransferSchema.index({ rawMaterial: 1, createdAt: -1 });
stockTransferSchema.index({ createdBy: 1, idempotencyKey: 1 }, { unique: true });

export default mongoose.model("StockTransfer", stockTransferSchema);
