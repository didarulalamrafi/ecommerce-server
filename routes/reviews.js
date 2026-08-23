import express from "express";
import * as reviewController from "../controllers/reviewController.js";

const router = express.Router();

// GET /api/reviews/:productId  -> ঐ প্রোডাক্টের সব রিভিউ
router.get("/:productId", reviewController.list);

// POST /api/reviews  -> নতুন রিভিউ তৈরি
router.post("/", reviewController.create);

// DELETE /api/reviews/:id  -> রিভিউ ডিলিট
router.delete("/:id", reviewController.remove);

export default router;
