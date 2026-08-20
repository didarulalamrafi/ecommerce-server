const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/rateLimiter");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register", authLimiter, asyncHandler(authController.register));
router.post("/login", authLimiter, asyncHandler(authController.login));
router.post("/logout", authController.logout);
router.get("/me", verifyToken, asyncHandler(authController.me));

module.exports = router;
