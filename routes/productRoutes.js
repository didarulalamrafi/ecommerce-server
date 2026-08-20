import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken, verifyAdmin } from "../middlewares/auth.js";
import * as productController from "../controllers/productController.js";

const router = express.Router();

router.get("/", asyncHandler(productController.list));
router.get("/:id", asyncHandler(productController.getOne));

router.post(
  "/",
  verifyToken,
  verifyAdmin,
  asyncHandler(productController.create),
);
router.put(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(productController.update),
);
router.delete(
  "/:id",
  verifyToken,
  verifyAdmin,
  asyncHandler(productController.remove),
);

export default router;
