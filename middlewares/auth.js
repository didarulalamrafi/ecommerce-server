const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../utils/token");

// লগইন ছাড়া এই middleware বসানো রুটে ঢোকা যাবে না
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: "লগইন করা প্রয়োজন" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, email, role }
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "সেশন মেয়াদোত্তীর্ণ, আবার লগইন করুন" });
  }
}

// verifyToken এর পরে বসাতে হয় — শুধু admin role পাস করতে পারবে
function verifyAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ error: "এই কাজের জন্য admin অ্যাক্সেস লাগবে" });
  }
  next();
}

module.exports = { verifyToken, verifyAdmin };
