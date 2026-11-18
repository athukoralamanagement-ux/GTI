import { Router } from "express";
import {
  forgotPassword,
  googleLogin,
  login,
  profile,
  register,
  requestRegisterOtp,
  resetPassword,
  verifyPasswordResetOtp
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { rateLimit } from "../middleware/securityMiddleware.js";

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, keyPrefix: "auth" });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "login", message: "Too many login attempts. Please try again later." });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 6, keyPrefix: "otp", message: "Too many OTP requests. Please try again later." });

router.post("/request-register-otp", otpLimiter, requestRegisterOtp);
router.post("/register", authLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/google", authLimiter, googleLogin);
router.post("/forgot-password", otpLimiter, forgotPassword);
router.post("/verify-reset-otp", authLimiter, verifyPasswordResetOtp);
router.post("/reset-password", authLimiter, resetPassword);
router.get("/me", protect, profile);

export default router;
