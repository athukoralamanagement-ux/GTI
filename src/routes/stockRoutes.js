import { Router } from "express";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { rateLimit, validateObjectIdParam } from "../middleware/securityMiddleware.js";
import { adjustStockItem, createStockItem, createTransfer, deleteStockItem, deleteTransfer, listStock, updateStockItem, updateTransfer } from "../controllers/stockController.js";

const router = Router();
router.use(protect, adminOnly, rateLimit({ windowMs: 15 * 60 * 1000, max: 120, keyPrefix: "stock-admin" }));
router.get("/", listStock);
router.post("/items", createStockItem);
router.put("/items/:id", validateObjectIdParam("id"), updateStockItem);
router.post("/items/:id/adjust", validateObjectIdParam("id"), adjustStockItem);
router.delete("/items/:id", validateObjectIdParam("id"), deleteStockItem);
router.post("/transfers", createTransfer);
router.put("/transfers/:id", validateObjectIdParam("id"), updateTransfer);
router.delete("/transfers/:id", validateObjectIdParam("id"), deleteTransfer);
export default router;
