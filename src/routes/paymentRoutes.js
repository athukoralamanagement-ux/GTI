import express, { Router } from "express";
import {
  createPaymentHash,
  getPaymentStatus,
  payhereNotify
} from "../controllers/paymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/securityMiddleware.js";

const router = Router();

router.post("/hash", protect, rateLimit({ windowMs: 15 * 60 * 1000, max: 12, keyPrefix: "payment-hash" }), createPaymentHash);
router.get("/status/:orderId", protect, getPaymentStatus);
router.post("/notify", express.urlencoded({ extended: true }), payhereNotify);

export default router;
