import mongoose from "mongoose";

const emailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, enum: ["register", "password-reset"], required: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false }
  },
  { timestamps: true }
);

emailOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export default mongoose.model("EmailOtp", emailOtpSchema);
