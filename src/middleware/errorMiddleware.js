export const notFound = (req, res) => {
  res.status(404);
  throw new Error(`Route not found: ${req.originalUrl}`);
};

export const errorHandler = (error, _req, res, _next) => {
  const status = error.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  res.status(status).json({
    message: error.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
};
