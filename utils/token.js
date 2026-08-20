const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
const IS_PROD = process.env.NODE_ENV === "production";

// লগইন/রেজিস্টারের পর টোকেন বানিয়ে httpOnly কুকিতে বসিয়ে দেয়
function sendTokenCookie(res, user) {
  const token = jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: IS_PROD,
    // frontend (ecommerce) আর backend (ecommerce-server) আলাদা Vercel
    // domain এ থাকায় production এ sameSite:"none" লাগবে, নাহলে cross-site
    // POST/PUT/DELETE এ কুকি পাঠাবে না
    sameSite: IS_PROD ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearTokenCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
  });
}

module.exports = { sendTokenCookie, clearTokenCookie, JWT_SECRET };
