import { Router } from "express";
import { BUILD_CATEGORIES } from "../data/buildParts.js";

const router = Router();

// Public catalog used by the Build My PC page. Prices here are also the
// authoritative values used when an order is created.
router.get("/build-parts", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({ categories: BUILD_CATEGORIES });
});

export default router;
