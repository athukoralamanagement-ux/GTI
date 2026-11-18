import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import buildRoutes from "./routes/buildRoutes.js";
import buildTemplateRoutes from "./routes/buildTemplateRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import offerRoutes from "./routes/offerRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import catalogPromotionRoutes from "./routes/catalogPromotionRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { rateLimit, sanitizeNoSql } from "./middleware/securityMiddleware.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = ["https://gticomputers.lk", "https://www.gticomputers.lk", "http://localhost:5173"];
const extraOrigins = [process.env.CLIENT_URL, process.env.CLIENT_URLS]
  .filter(Boolean)
  .flatMap((value) => String(value).split(","))
  .map((value) => value.trim())
  .filter(Boolean);
allowedOrigins.push(...extraOrigins);

// In development Vite may fall back to another port when 5173 is taken,
// so accept any localhost origin outside production.
const isDevLocalhostOrigin = (origin) =>
  process.env.NODE_ENV !== "production" &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "base-uri": ["'self'"],
      "connect-src": ["'self'", "https://gticomputers-production.up.railway.app", "https://www.payhere.lk", "https://sandbox.payhere.lk", "https://accounts.google.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "frame-src": ["'self'", "https://www.payhere.lk", "https://sandbox.payhere.lk", "https://accounts.google.com"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "script-src": ["'self'", "'unsafe-inline'", "https://www.payhere.lk", "https://sandbox.payhere.lk", "https://accounts.google.com", "https://apis.google.com"],
      "script-src-attr": ["'none'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
    }
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  strictTransportSecurity: process.env.NODE_ENV === "production"
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
    : false,
  frameguard: { action: "sameorigin" }
}));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, "");
      const isAllowed =
        isDevLocalhostOrigin(normalizedOrigin) ||
        allowedOrigins.some(
          (url) => url.replace(/\/$/, "") === normalizedOrigin
        );
      if (isAllowed) {
        callback(null, true);
      } else {
        const error = new Error(`Origin ${origin} is not allowed by CORS`);
        error.statusCode = 403;
        callback(error);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600
  })
);
app.use(express.json({ limit: "6mb" }));
app.use(express.urlencoded({ extended: true, limit: "6mb" }));
app.use(sanitizeNoSql);

// Return clean JSON for malformed payloads instead of an HTML parser error.
app.use((error, _req, res, next) => {
  if (error?.type === "entity.parse.failed" || error instanceof SyntaxError) {
    return res.status(400).json({ message: "Invalid JSON payload" });
  }
  return next(error);
});

// Broad abuse protection. Individual write/auth routes add tighter buckets.
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 900, keyPrefix: "api" }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "gti-computers-api" });
});
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/build-templates", buildTemplateRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api", buildRoutes);
app.use("/api", catalogPromotionRoutes);

if (process.env.NODE_ENV === "production") {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(currentDir, "../../client/dist");

  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.originalUrl.startsWith("/api")) return next();
      return res.sendFile(path.join(clientDist, "index.html"));
    });
  }
}

app.use(notFound);
app.use(errorHandler);

export default app;
