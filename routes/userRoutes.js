const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middlewares/auth");
const userController = require("../controllers/userController");

const router = express.Router();

router.patch("/me", verifyToken, asyncHandler(userController.updateMe));

module.exports = router;
