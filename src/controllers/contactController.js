import asyncHandler from "express-async-handler";
import ContactMessage from "../models/ContactMessage.js";

const cleanText = (value, max = 500) => String(value || "").trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createContactMessage = asyncHandler(async (req, res) => {
  const { firstName, lastName = "", subject, message } = req.body;
  const email = req.user?.email;
  if (!firstName || !email || !subject || !message) {
    res.status(400);
    throw new Error("First name, subject, and message are required");
  }
  if (!emailPattern.test(String(email).trim().toLowerCase())) {
    res.status(400);
    throw new Error("Enter a valid email address");
  }

  const created = await ContactMessage.create({
    user: req.user._id,
    firstName: cleanText(firstName, 80),
    lastName: cleanText(lastName, 80),
    email: cleanText(email, 160).toLowerCase(),
    subject: cleanText(subject, 120),
    message: cleanText(message, 2000)
  });
  res.status(201).json({ message: "Message sent", contactMessage: created });
});

export const listContactMessages = asyncHandler(async (_req, res) => {
  res.json(await ContactMessage.find().populate("user", "name email").sort({ createdAt: -1 }));
});

export const updateContactMessageStatus = asyncHandler(async (req, res) => {
  const allowed = ["new", "read", "replied"];
  if (!allowed.includes(req.body.status)) {
    res.status(400);
    throw new Error("Invalid message status");
  }
  const message = await ContactMessage.findById(req.params.id);
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }
  message.status = req.body.status;
  res.json(await message.save());
});

export const replyToContactMessage = asyncHandler(async (req, res) => {
  const reply = cleanText(req.body.reply, 2000);
  if (!reply) {
    res.status(400);
    throw new Error("Reply message is required");
  }
  const message = await ContactMessage.findById(req.params.id);
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }
  message.reply = reply;
  message.repliedAt = new Date();
  message.repliedBy = req.user._id;
  message.replySeenAt = undefined;
  message.status = "replied";
  res.json(await message.save());
});

export const getMyContactMessages = asyncHandler(async (req, res) => {
  const email = req.user.email;
  const messages = await ContactMessage.find({
    $or: [
      { user: req.user._id },
      { user: { $exists: false }, email },
      { user: null, email }
    ]
  }).sort({ createdAt: -1 });
  res.json(messages);
});

export const getMyContactUnreadCount = asyncHandler(async (req, res) => {
  const email = req.user.email;
  const count = await ContactMessage.countDocuments({
    reply: { $ne: "" },
    replySeenAt: { $exists: false },
    $or: [
      { user: req.user._id },
      { user: { $exists: false }, email },
      { user: null, email }
    ]
  });
  res.json({ count });
});

export const markMyContactRepliesSeen = asyncHandler(async (req, res) => {
  const email = req.user.email;
  const result = await ContactMessage.updateMany(
    {
      reply: { $ne: "" },
      replySeenAt: { $exists: false },
      $or: [
        { user: req.user._id },
        { user: { $exists: false }, email },
        { user: null, email }
      ]
    },
    { $set: { replySeenAt: new Date() } }
  );
  res.json({ message: "Support replies marked as seen", modifiedCount: result.modifiedCount || 0 });
});

export const deleteContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }
  res.json({ message: "Message deleted successfully" });
});
