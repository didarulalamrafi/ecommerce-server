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
