import rateLimit from "express-rate-limit";

// better-auth নিজের রুটে (/api/auth/*) নিজস্ব rate limiting করে, তাই এখানে
// শুধু আমাদের নিজেদের /api রুটের জন্য একটা general limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
