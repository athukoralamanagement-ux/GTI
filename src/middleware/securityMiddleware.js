import mongoose from "mongoose";

const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);

const sanitizeValue = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);

  const clean = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".") || dangerousKeys.has(key)) continue;
    clean[key] = sanitizeValue(nestedValue);
  }
  return clean;
};

export const sanitizeNoSql = (req, _res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) {
    const cleanQuery = sanitizeValue(req.query);
    Object.defineProperty(req, "query", {
      value: cleanQuery,
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
  next();
};

const buckets = new Map();

export const rateLimit = ({ windowMs = 60_000, max = 60, keyPrefix = "global", message = "Too many requests. Please try again soon." } = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    // Never trust an arbitrary X-Forwarded-For header here. Express already
    // resolves req.ip using the configured trusted proxy count.
    const identity = String(req.user?._id || req.ip || "unknown").slice(0, 120);
    const key = `${keyPrefix}:${identity}`;
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({ message });
    }

    if (buckets.size > 10_000) {
      for (const [storedKey, storedBucket] of buckets.entries()) {
        if (storedBucket.resetAt <= now) buckets.delete(storedKey);
      }
    }

    next();
  };
};

export const validateObjectIdParam = (paramName = "id") => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(String(req.params[paramName] || ""))) {
    return res.status(400).json({ message: "Invalid resource identifier" });
  }
  next();
};
