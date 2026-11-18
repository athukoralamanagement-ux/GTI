import { Router } from "express";
import {
  createContactMessage,
  listContactMessages,
  replyToContactMessage,
  updateContactMessageStatus,
  getMyContactMessages,
  getMyContactUnreadCount,
  markMyContactRepliesSeen,
  deleteContactMessage
} from "../controllers/contactController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { rateLimit, validateObjectIdParam } from "../middleware/securityMiddleware.js";

const router = Router();

router.post("/", protect, rateLimit({ windowMs: 15 * 60 * 1000, max: 8, keyPrefix: "contact" }), createContactMessage);
router.get("/mine/unread-count", protect, getMyContactUnreadCount);
router.patch("/mine/seen", protect, markMyContactRepliesSeen);
router.get("/mine", protect, getMyContactMessages);
router.get("/", protect, adminOnly, listContactMessages);
router.patch("/:id/status", protect, adminOnly, validateObjectIdParam("id"), updateContactMessageStatus);
router.patch("/:id/reply", protect, adminOnly, validateObjectIdParam("id"), replyToContactMessage);
router.delete("/:id", protect, adminOnly, validateObjectIdParam("id"), deleteContactMessage);

export default router;
