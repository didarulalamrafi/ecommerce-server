const rateLimit = require("express-rate-limit");

// login/register এ brute-force আটকাতে কড়া limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "অনেকবার চেষ্টা করা হয়েছে, একটু পর আবার চেষ্টা করুন" },
});

// বাকি সব /api রুটে একটা loose general limiter, শুধু abuse ঠেকানোর জন্য
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { authLimiter, apiLimiter };
