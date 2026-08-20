const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const productController = require("../controllers/productController");
const newsletterController = require("../controllers/newsletterController");

const router = express.Router();

router.get("/categories", asyncHandler(productController.categories));
router.post("/newsletter", asyncHandler(newsletterController.subscribe));

module.exports = router;
