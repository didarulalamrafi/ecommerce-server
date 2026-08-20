const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middlewares/auth");
const orderController = require("../controllers/orderController");

const router = express.Router();

router.use(verifyToken);

router.post("/", asyncHandler(orderController.checkout));
router.get("/me", asyncHandler(orderController.myOrders));

module.exports = router;
