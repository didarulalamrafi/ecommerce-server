import express from "express";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

// শুধু এই ফিল্ডগুলো ইউজার নিজে বদলাতে পারবে — email/role ইচ্ছাকৃতভাবে
// বাইরে রাখা হয়েছে (email আলাদা verification ফ্লো লাগে, role শুধু admin
// বদলাতে পারবে — নিরাপত্তার জন্য)
const ALLOWED_FIELDS = ["name", "number", "address", "bio"];

// PATCH /api/user/profile — লগইন করা ইউজার নিজের প্রোফাইল আপডেট করবে
router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const update = {};
    for (const field of ALLOWED_FIELDS) {
      if (typeof req.body[field] === "string") {
        update[field] = req.body[field].trim();
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "আপডেট করার মতো কোনো তথ্য নেই" });
    }

    // better-auth এর mongodb adapter user id হিসেবে string id ব্যবহার করে,
    // তবে পুরনো ভার্সন/কনফিগে _id সরাসরি ObjectId ও হতে পারে — দুটোই চেক করছি
    const userId = req.user.id;
    const idFilter = ObjectId.isValid(userId)
      ? { $or: [{ _id: new ObjectId(userId) }, { id: userId }] }
      : { id: userId };

    const result = await req.db
      .collection("user")
      .updateOne(idFilter, { $set: update });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "ইউজার খুঁজে পাওয়া যায়নি" });
    }

    const updatedUser = await req.db.collection("user").findOne(idFilter, {
      projection: { password: 0 },
    });

    res.json({ user: updatedUser });
  } catch (err) {
    console.error("প্রোফাইল আপডেটে সমস্যা:", err);
    res.status(500).json({ error: "প্রোফাইল আপডেট করা যায়নি" });
  }
});

export default router;
