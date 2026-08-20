import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/auth.js";
import * as orderController from "../controllers/orderController.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", asyncHandler(orderController.checkout));
router.get("/me", asyncHandler(orderController.myOrders));

export default router;
