import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  listCategories,
  updateCategory
} from "../controllers/categoryController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { validateObjectIdParam } from "../middleware/securityMiddleware.js";

const router = Router();

router.get("/", listCategories);
router.get("/admin/all", protect, adminOnly, listAdminCategories);
router.post("/", protect, adminOnly, createCategory);
router.put("/:id", protect, adminOnly, validateObjectIdParam("id"), updateCategory);
router.patch("/:id", protect, adminOnly, validateObjectIdParam("id"), updateCategory);
router.delete("/:id", protect, adminOnly, validateObjectIdParam("id"), deleteCategory);

export default router;
