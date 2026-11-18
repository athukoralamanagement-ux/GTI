import asyncHandler from "express-async-handler";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import EmailOtp from "../models/EmailOtp.js";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { sendOtpEmail } from "../utils/emailService.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  token: generateToken(user)
});

const normalizeEmail = (email) => String(email || "").trim().toLowerCase().slice(0, 254);

const requireValidEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!emailPattern.test(normalizedEmail)) {
    resStatusError(400, "Enter a valid email address.");
  }
  return normalizedEmail;
};

const requireStrongPassword = (password) => {
  const value = String(password || "");
  if (value.length < 8) resStatusError(400, "Password must contain at least 8 characters.");
  if (value.length > 128) resStatusError(400, "Password must be 128 characters or fewer.");
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    resStatusError(400, "Password must include at least one letter and one number.");
  }
  return value;
};

// Used to keep failed-login timing comparable when an email does not exist.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("gti-timing-equalizer-2026", 12);

const resStatusError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  throw error;
};

const generateOtp = () => String(crypto.randomInt(100000, 1000000));
const getOtpSecret = () => {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("OTP_SECRET or JWT_SECRET must be configured.");
  }
  return secret;
};

const hashOtp = (email, purpose, otp) =>
  crypto
    .createHash("sha256")
    .update(`${email}:${purpose}:${otp}:${getOtpSecret()}`)
    .digest("hex");

const createOtp = async (email, purpose) => {
  const otp = generateOtp();
  await EmailOtp.updateMany({ email, purpose, used: false }, { used: true });
  await EmailOtp.create({
    email,
    purpose,
    otpHash: hashOtp(email, purpose, otp),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)
  });
  await sendOtpEmail({ to: email, otp, purpose });
};

const verifyOtp = async (email, purpose, otp, { consume = true } = {}) => {
  const cleanOtp = String(otp || "").trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    resStatusError(400, "Enter the 6 digit OTP sent to your email.");
  }

  const record = await EmailOtp.findOne({
    email,
    purpose,
    used: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!record) {
    resStatusError(400, "OTP expired or not found. Please request a new OTP.");
  }
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    record.used = true;
    await record.save();
    resStatusError(429, "Too many OTP attempts. Please request a new OTP.");
  }

  record.attempts += 1;
  const enteredHash = hashOtp(email, purpose, cleanOtp);
  const valid =
    record.otpHash.length === enteredHash.length &&
    crypto.timingSafeEqual(Buffer.from(record.otpHash), Buffer.from(enteredHash));

  if (!valid) {
    await record.save();
    resStatusError(400, "Invalid OTP. Please check the code and try again.");
  }

  if (consume) {
    record.used = true;
  }
  await record.save();
};

export const requestRegisterOtp = asyncHandler(async (req, res) => {
  const email = requireValidEmail(req.body.email);
  if (await User.exists({ email })) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }
  await createOtp(email, "register");
  res.json({ message: "OTP sent to your email address." });
});

export const register = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const email = requireValidEmail(req.body.email);
  const name = String(req.body.name || "").trim().slice(0, 80);
  if (!name || !email || !req.body.password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }
  const password = requireStrongPassword(req.body.password);
  await verifyOtp(email, "register", otp);
  if (await User.exists({ email })) {
    res.status(409);
    throw new Error("An account with this email already exists");
  }

  const user = await User.create({ name, email, password });
  res.status(201).json(userResponse(user));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = requireValidEmail(req.body.email);
  const user = await User.findOne({ email });
  if (user) {
    await createOtp(email, "password-reset");
  }
  res.json({ message: "If an account exists for this email, an OTP has been sent." });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const email = requireValidEmail(req.body.email);
  const password = requireStrongPassword(req.body.password);

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("No account found for this email address");
  }

  await verifyOtp(email, "password-reset", otp);
  user.password = password;
  await user.save();
  res.json({ message: "Password updated successfully. Please sign in with your new password." });
});

export const verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const email = requireValidEmail(req.body.email);
  await verifyOtp(email, "password-reset", req.body.otp, { consume: false });
  res.json({ message: "OTP verified. You can now set a new password." });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = requireValidEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select("+password");
  if (!user) {
    // Equalize timing so attackers cannot enumerate registered emails.
    await bcrypt.compare(String(password || ""), DUMMY_PASSWORD_HASH);
  }
  if (!user || !(await user.matchesPassword(String(password || "")))) {
    res.status(401);
    throw new Error("Email or password is incorrect");
  }
  res.json(userResponse(user));
});

export const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    res.status(400);
    throw new Error("Missing Google credential");
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503);
    throw new Error("Google sign-in is not configured");
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: String(credential),
      audience: process.env.GOOGLE_CLIENT_ID
    });
  } catch {
    res.status(401);
    throw new Error("Invalid or expired Google credential");
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    res.status(400);
    throw new Error("Invalid Google token");
  }
  if (payload.email_verified === false) {
    res.status(400);
    throw new Error("Google email is not verified");
  }

  const { email, name } = payload;
  
  let user = await User.findOne({ email: email.toLowerCase() });
  
  if (!user) {
    const randomPassword = crypto.randomBytes(24).toString("base64url");
    user = await User.create({
      name: name || "Google User",
      email: email.toLowerCase(),
      password: randomPassword
    });
  }

  res.json(userResponse(user));
});

export const profile = asyncHandler(async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  });
});
