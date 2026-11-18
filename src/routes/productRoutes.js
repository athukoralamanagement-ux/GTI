import { Router } from "express";
import {
  addProductReview,
  createProduct,
  deleteProduct,
  hardDeleteProduct,
  deleteProductReview,
  getProduct,
  listProductCategories,
  listAdminProducts,
  listProducts,
  updateProduct,
  updateProductReviewStatus
} from "../controllers/productController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { rateLimit, validateObjectIdParam } from "../middleware/securityMiddleware.js";

const router = Router();
router.get("/", listProducts);
router.get("/categories", listProductCategories);
router.get("/admin/all", protect, adminOnly, listAdminProducts);
router.post("/", protect, adminOnly, createProduct);
router.put("/:id", protect, adminOnly, validateObjectIdParam("id"), updateProduct);
router.delete("/:id", protect, adminOnly, validateObjectIdParam("id"), deleteProduct);
router.delete("/:id/hard", protect, adminOnly, validateObjectIdParam("id"), hardDeleteProduct);
router.patch("/:productId/reviews/:reviewId", protect, adminOnly, validateObjectIdParam("productId"), validateObjectIdParam("reviewId"), updateProductReviewStatus);
router.delete("/:productId/reviews/:reviewId", protect, adminOnly, validateObjectIdParam("productId"), validateObjectIdParam("reviewId"), deleteProductReview);
router.post("/:slug/reviews", rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyPrefix: "review" }), addProductReview);
router.get("/:slug", getProduct);

export default router;
