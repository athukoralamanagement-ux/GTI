import { Router } from "express";
import {
  createOffer,
  deleteOffer,
  getOfferByCode,
  listOffers,
  toggleOffer,
  trackOfferVisit,
  updateOffer,
  validateOfferByCode
} from "../controllers/offerController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { rateLimit, validateObjectIdParam } from "../middleware/securityMiddleware.js";

const router = Router();

router.get("/code/:code", rateLimit({ windowMs: 15 * 60 * 1000, max: 80, keyPrefix: "offer-scan" }), getOfferByCode);
router.get("/code/:code/status", rateLimit({ windowMs: 15 * 60 * 1000, max: 120, keyPrefix: "offer-status" }), validateOfferByCode);
router.post("/code/:code/visit", rateLimit({ windowMs: 15 * 60 * 1000, max: 80, keyPrefix: "offer-visit" }), trackOfferVisit);
router.get("/", protect, adminOnly, listOffers);
router.post("/", protect, adminOnly, createOffer);
router.put("/:id", protect, adminOnly, validateObjectIdParam("id"), updateOffer);
router.patch("/:id/status", protect, adminOnly, validateObjectIdParam("id"), toggleOffer);
router.delete("/:id", protect, adminOnly, validateObjectIdParam("id"), deleteOffer);

export default router;
