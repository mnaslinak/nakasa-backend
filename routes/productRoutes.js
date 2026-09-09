import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  deleteProduct,
  updateProduct,
} from "../controllers/productController.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", getProducts);

router.get("/:id", getProductById);

router.post("/", upload.single("image"), createProduct);
  
router.delete("/:id", deleteProduct);
router.put("/:id", upload.single("image"), updateProduct);

export default router;