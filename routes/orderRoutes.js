import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/auth.js";
import * as orderController from "../controllers/orderController.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", asyncHandler(orderController.checkout));
router.get("/me", asyncHandler(orderController.myOrders));

// ---- admin (whole-order, legacy) ----
router.get("/pending", asyncHandler(orderController.pendingOrders));
router.patch("/:id/approve", asyncHandler(orderController.approveOrder));
router.patch("/:id/reject", asyncHandler(orderController.rejectOrder));

// ---- seller (item-level, নতুন) ----
router.get("/seller/me", asyncHandler(orderController.mySellerOrders));
router.patch(
  "/:id/items/:productId/approve",
  asyncHandler(orderController.approveOrderItem),
);
router.patch(
  "/:id/items/:productId/deliver",
  asyncHandler(orderController.deliverOrderItem),
);
router.patch(
  "/:id/items/:productId/cancel",
  asyncHandler(orderController.cancelOrderItem),
);

export default router;
