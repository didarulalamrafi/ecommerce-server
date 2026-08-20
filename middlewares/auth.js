// middlewares/auth.js
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";

// UPDATED: আগে JWT cookie নিজে verify করা হতো, এখন better-auth এর নিজস্ব
// session store থেকে সেশন চেক করা হচ্ছে — এটাই better-auth ব্যবহারের মূল
// লাভ, session revoke/expire সব better-auth নিজে সামলায়
export async function verifyToken(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({ error: "লগইন করা প্রয়োজন" });
    }

    req.user = session.user; // { id, name, email, role, number, address, bio, ... }
    req.session = session.session;
    next();
  } catch (err) {
    return res.status(401).json({ error: "সেশন যাচাই করা যায়নি" });
  }
}

export function verifyAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ error: "এই কাজের জন্য admin অ্যাক্সেস লাগবে" });
  }
  next();
}

// NEW: একাধিক role এর জন্য — যেমন seller আর admin দুইজনেই প্রোডাক্ট
// যোগ করতে পারবে, কিন্তু customer পারবে না
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "এই কাজের জন্য অনুমতি নেই" });
    }
    next();
  };
}

// NEW: প্রোডাক্ট এডিট/ডিলিট করার আগে চেক করে — admin সব প্রোডাক্টে হাত
// দিতে পারবে, কিন্তু seller শুধু নিজের বানানো প্রোডাক্টে। এটা verifyToken
// এর পরে বসাতে হয়, আর productController এর route param থেকে id লাগবে।
export async function verifyProductOwnerOrAdmin(req, res, next) {
  if (req.user.role === "admin") return next(); // admin সবসময় পাস

  const { ObjectId } = await import("mongodb");
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }

  const product = await req.db
    .collection("products")
    .findOne({ _id: new ObjectId(id) });
  if (!product) {
    return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
  }
  if (product.sellerId !== req.user.id) {
    return res
      .status(403)
      .json({ error: "শুধু নিজের প্রোডাক্টে এই কাজ করা যাবে" });
  }
  next();
}
