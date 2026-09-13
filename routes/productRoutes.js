import express from "express";

import {
  getProducts,
  getProductById,
  createProduct,
  createBulkProducts,
  deleteProduct,
  updateProduct,
} from "../controllers/productController.js";

import upload from "../middleware/uploadMiddleware.js";
import verifyJWT from "../middleware/verifyJWT.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get all products
router.get(
  "/",
  getProducts
);

// ==========================================
// ADMIN BULK UPLOAD
// ==========================================

// IMPORTANT:
// This must receive:
// products = JSON string
// images = multiple files
router.post(
  "/bulk",
  verifyJWT,
  verifyAdmin,
  upload.array("images", 100),
  createBulkProducts
);

// ==========================================
// PUBLIC SINGLE PRODUCT
// ==========================================

router.get(
  "/:id",
  getProductById
);

// ==========================================
// ADMIN CREATE PRODUCT
// ==========================================

router.post(
  "/",
  verifyJWT,
  verifyAdmin,
  upload.single("image"),
  createProduct
);

// ==========================================
// ADMIN UPDATE PRODUCT
// ==========================================

router.put(
  "/:id",
  verifyJWT,
  verifyAdmin,
  upload.single("image"),
  updateProduct
);

// ==========================================
// ADMIN DELETE PRODUCT
// ==========================================

router.delete(
  "/:id",
  verifyJWT,
  verifyAdmin,
  deleteProduct
);

export default router;