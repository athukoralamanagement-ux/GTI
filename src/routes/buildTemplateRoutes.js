import { Router } from "express";
import {
  createBuildTemplate,
  deleteBuildTemplate,
  getBuildTemplate,
  listAdminBuildTemplates,
  listBuildTemplates,
  updateBuildTemplate
} from "../controllers/buildTemplateController.js";
import { adminOnly, protect } from "../middleware/authMiddleware.js";
import { validateObjectIdParam } from "../middleware/securityMiddleware.js";

const router = Router();

router.get("/", listBuildTemplates);
router.get("/admin/all", protect, adminOnly, listAdminBuildTemplates);
router.post("/", protect, adminOnly, createBuildTemplate);
router.put("/:id", protect, adminOnly, validateObjectIdParam("id"), updateBuildTemplate);
router.delete("/:id", protect, adminOnly, validateObjectIdParam("id"), deleteBuildTemplate);
router.get("/:slug", getBuildTemplate);

export default router;
