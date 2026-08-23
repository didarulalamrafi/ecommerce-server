import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/auth.js";
import * as orderController from "../controllers/orderController.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", asyncHandler(orderController.checkout));
router.get("/me", asyncHandler(orderController.myOrders));

// ✅ seller/admin এর জন্য pending অর্ডার ম্যানেজমেন্ট
router.get("/pending", asyncHandler(orderController.pendingOrders));
router.patch("/:id/approve", asyncHandler(orderController.approveOrder));
router.patch("/:id/reject", asyncHandler(orderController.rejectOrder));

export default router;
