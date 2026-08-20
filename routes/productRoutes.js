const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, verifyAdmin } = require("../middlewares/auth");
const productController = require("../controllers/productController");

const router = express.Router();

// পাবলিক — লগইন লাগবে না
router.get("/", asyncHandler(productController.list));
router.get("/:id", asyncHandler(productController.getOne));

// admin-only
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

module.exports = router;
