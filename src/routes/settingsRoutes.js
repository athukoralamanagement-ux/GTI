import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", getSettings);
router.put("/", protect, adminOnly, updateSettings);

export default router;
