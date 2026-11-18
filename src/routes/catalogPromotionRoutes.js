import { Router } from "express";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { validateObjectIdParam } from "../middleware/securityMiddleware.js";
import {
  createDiscounts, createGiftBox, deleteDiscount, deleteGiftBox, duplicateGiftBox, getGiftBox,
  listActiveGiftBoxes, listAdminGiftBoxes, listDiscounts, listGiftBoxes, toggleGiftBox, updateDiscount, updateGiftBox
} from "../controllers/catalogPromotionController.js";

const router = Router();

router.get("/discounts", protect, adminOnly, listDiscounts);
router.post("/discounts", protect, adminOnly, createDiscounts);
router.put("/discounts/:id", protect, adminOnly, validateObjectIdParam("id"), updateDiscount);
router.delete("/discounts/:id", protect, adminOnly, validateObjectIdParam("id"), deleteDiscount);
router.get("/gift-boxes", listGiftBoxes);
router.get("/gift-boxes/active", listActiveGiftBoxes);
router.get("/gift-boxes/admin/all", protect, adminOnly, listAdminGiftBoxes);
router.post("/gift-boxes", protect, adminOnly, createGiftBox);
router.put("/gift-boxes/:id", protect, adminOnly, validateObjectIdParam("id"), updateGiftBox);
router.patch("/gift-boxes/:id/status", protect, adminOnly, validateObjectIdParam("id"), toggleGiftBox);
router.post("/gift-boxes/:id/duplicate", protect, adminOnly, validateObjectIdParam("id"), duplicateGiftBox);
router.delete("/gift-boxes/:id", protect, adminOnly, validateObjectIdParam("id"), deleteGiftBox);
router.get("/gift-boxes/:slug", getGiftBox);

export default router;
