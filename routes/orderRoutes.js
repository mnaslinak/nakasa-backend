import express from "express";

import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = express.Router();

// Create new order
router.post("/", createOrder);

// Get all orders
router.get("/", getOrders);

// Get single order
router.get("/:id", getOrderById);

// Update order status
router.put("/:id/status", updateOrderStatus);

export default router;