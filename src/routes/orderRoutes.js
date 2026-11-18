import { Router } from "express";
import {
  createOrder,
  createManualOrder,
  getOrder,
  updateManualOrder,
  listOrders,
  myOrders,
  updatePaymentStatus,
  updateOrderStatus,
  deleteOrder
} from "../controllers/orderController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { rateLimit, validateObjectIdParam } from "../middleware/securityMiddleware.js";

const router = Router();
router.use(protect);
router.post("/", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "orders" }), createOrder);
router.post("/manual", adminOnly, createManualOrder);
router.put("/:id/manual", adminOnly, validateObjectIdParam("id"), updateManualOrder);
router.get("/mine", myOrders);
router.get("/", adminOnly, listOrders);
router.get("/:id", validateObjectIdParam("id"), getOrder);
router.patch("/:id/status", adminOnly, validateObjectIdParam("id"), updateOrderStatus);
router.patch("/:id/payment-status", adminOnly, validateObjectIdParam("id"), updatePaymentStatus);
router.delete("/:id", adminOnly, validateObjectIdParam("id"), deleteOrder);

export default router;
