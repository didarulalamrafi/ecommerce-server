import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  verifyToken,
  requireRole,
  verifyProductOwnerOrAdmin,
} from "../middlewares/auth.js";
import * as productController from "../controllers/productController.js";

const router = express.Router();

// পাবলিক — লগইন লাগবে না
router.get("/", asyncHandler(productController.list));

// NEW: seller/admin এর নিজের প্রোডাক্ট লিস্ট — এটাকে /:id এর আগে বসাতে
// হবে, নাহলে Express "mine" কে product id হিসেবে ধরে ফেলবে
router.get(
  "/mine",
  verifyToken,
  requireRole(["admin", "seller"]),
  asyncHandler(productController.mine),
);

router.get("/:id", asyncHandler(productController.getOne));

// seller ও admin দুইজনেই প্রোডাক্ট বানাতে পারবে
router.post(
  "/",
  verifyToken,
  requireRole(["admin", "seller"]),
  asyncHandler(productController.create),
);

// এডিট/ডিলিট — নিজের প্রোডাক্ট হলে seller পারবে, admin সবসময় পারবে
router.put(
  "/:id",
  verifyToken,
  requireRole(["admin", "seller"]),
  verifyProductOwnerOrAdmin,
  asyncHandler(productController.update),
);
router.delete(
  "/:id",
  verifyToken,
  requireRole(["admin", "seller"]),
  verifyProductOwnerOrAdmin,
  asyncHandler(productController.remove),
);

export default router;
