import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../middlewares/auth.js";
import * as cartController from "../controllers/cartController.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", asyncHandler(cartController.getCart));
router.post("/", asyncHandler(cartController.addToCart));
router.put("/:productId", asyncHandler(cartController.updateItem));
router.delete("/:productId", asyncHandler(cartController.removeItem));

export default router;
