const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middlewares/auth");
const cartController = require("../controllers/cartController");

const router = express.Router();

router.use(verifyToken); // এই router এর সব রুট লগইন-প্রোটেক্টেড

router.get("/", asyncHandler(cartController.getCart));
router.post("/", asyncHandler(cartController.addToCart));
router.put("/:productId", asyncHandler(cartController.updateItem));
router.delete("/:productId", asyncHandler(cartController.removeItem));

module.exports = router;
