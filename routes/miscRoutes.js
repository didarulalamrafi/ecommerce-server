import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as productController from "../controllers/productController.js";
import * as newsletterController from "../controllers/newsletterController.js";

const router = express.Router();

router.get("/categories", asyncHandler(productController.categories));
router.post("/newsletter", asyncHandler(newsletterController.subscribe));

export default router;
