import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, default: "", trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    reply: { type: String, default: "", trim: true, maxlength: 2000 },
    repliedAt: { type: Date },
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    replySeenAt: { type: Date },
    status: { type: String, enum: ["new", "read", "replied"], default: "new" }
  },
  { timestamps: true }
);

contactMessageSchema.index({ user: 1, createdAt: -1 });
contactMessageSchema.index({ email: 1, createdAt: -1 });
contactMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("ContactMessage", contactMessageSchema);
