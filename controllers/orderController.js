import Order from "../models/order.js";

// ==========================================
// CREATE ORDER
// ==========================================
export const createOrder = async (req, res) => {
  try {
    const {
      customer,
      items,
      subtotal,
      deliveryFee,
      total,
      paymentMethod,
    } = req.body;

    // Check required data
    if (!customer || !items || items.length === 0) {
      return res.status(400).json({
        message: "Customer information and order items are required",
      });
    }

    // Create order
    const order = await Order.create({
      customer,
      items,
      subtotal,
      deliveryFee,
      total,
      paymentMethod: paymentMethod || "Cash on Delivery",
    });

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// ==========================================
// GET ALL ORDERS
// ==========================================
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get orders",
      error: error.message,
    });
  }
};

// ==========================================
// GET SINGLE ORDER
// ==========================================
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get order",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE ORDER STATUS
// ==========================================
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    order.status = status;

    const updatedOrder = await order.save();

    res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};