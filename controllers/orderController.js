import mongoose from "mongoose";
import Order from "../models/order.js";
import Product from "../models/product.js";

const DELIVERY_FEE = 300;

const VALID_STATUSES = [
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled",
];

const VALID_PAYMENT_METHODS = [
    "Cash on Delivery",
];


// ==========================================
// CREATE ORDER
// Logged-in customers only
// ==========================================

export const createOrder = async (req, res) => {
    try {
        const {
            customer,
            items,
            paymentMethod,
        } = req.body;


        // verifyJWT should provide req.user

        if (!req.user?._id) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }


        // Validate customer and items

        if (
            !customer ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                message:
                    "Customer information and order items are required",
            });
        }


        // Email is not required from the frontend.
        // It comes from the logged-in user.

        const requiredCustomerFields = [
            "firstName",
            "lastName",
            "phone",
            "address",
            "city",
            "postalCode",
        ];

        const missingField =
            requiredCustomerFields.find((field) => {
                return !String(
                    customer[field] ?? ""
                ).trim();
            });

        if (missingField) {
            return res.status(400).json({
                message: `${missingField} is required`,
            });
        }


        // Validate payment method

        const selectedPaymentMethod =
            paymentMethod || "Cash on Delivery";

        if (
            !VALID_PAYMENT_METHODS.includes(
                selectedPaymentMethod
            )
        ) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }


        // Validate product IDs and quantities

        for (const item of items) {
            if (
                !mongoose.isValidObjectId(
                    item.productId
                )
            ) {
                return res.status(400).json({
                    message:
                        "One or more order items have an invalid product ID",
                });
            }

            const quantity = Number(item.quantity);

            if (
                !Number.isInteger(quantity) ||
                quantity < 1
            ) {
                return res.status(400).json({
                    message:
                        "Each product quantity must be a whole number greater than 0",
                });
            }
        }


        const productIds = items.map(
            (item) => String(item.productId)
        );


        // Prevent duplicate product entries

        if (
            new Set(productIds).size !==
            productIds.length
        ) {
            return res.status(400).json({
                message:
                    "The same product cannot appear more than once",
            });
        }


        // Retrieve real product information from MongoDB

        const products = await Product.find({
            _id: {
                $in: productIds,
            },
        });

        if (
            products.length !==
            productIds.length
        ) {
            return res.status(400).json({
                message:
                    "One or more products no longer exist",
            });
        }


        const productMap = new Map(
            products.map((product) => [
                String(product._id),
                product,
            ])
        );


        // Use product names and prices from MongoDB

        const orderItems = items.map((item) => {
            const product = productMap.get(
                String(item.productId)
            );

            return {
                productId: product._id,
                name: product.name,
                price: product.price,
                quantity: Number(item.quantity),
                image: product.image || "",
            };
        });


        // Calculate totals on the backend

        const subtotal = orderItems.reduce(
            (sum, item) => {
                return (
                    sum +
                    item.price * item.quantity
                );
            },
            0
        );

        const total =
            subtotal + DELIVERY_FEE;


        // Create order connected to logged-in user

        const order = await Order.create({
            user: req.user._id,

            customer: {
                firstName: String(
                    customer.firstName
                ).trim(),

                lastName: String(
                    customer.lastName
                ).trim(),

                email: req.user.email
                    .trim()
                    .toLowerCase(),

                phone: String(
                    customer.phone
                ).trim(),

                address: String(
                    customer.address
                ).trim(),

                city: String(
                    customer.city
                ).trim(),

                postalCode: String(
                    customer.postalCode
                ).trim(),
            },

            items: orderItems,

            subtotal,

            deliveryFee: DELIVERY_FEE,

            total,

            paymentMethod:
                selectedPaymentMethod,
        });


        return res.status(201).json({
            message:
                "Order created successfully",

            order,
        });

    } catch (error) {
        console.error(
            "Create order error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to create order",
        });
    }
};


// ==========================================
// GET ALL ORDERS
// Admin only
// ==========================================

export const getOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate(
                "user",
                "firstName lastName email phone"
            )
            .sort({
                createdAt: -1,
            });

        return res.status(200).json(
            orders
        );

    } catch (error) {
        console.error(
            "Get orders error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to get orders",
        });
    }
};


// ==========================================
// GET LOGGED-IN CUSTOMER ORDERS
// ==========================================

export const getMyOrders = async (
    req,
    res
) => {
    try {
        if (!req.user?._id) {
            return res.status(401).json({
                message:
                    "Authentication required",
            });
        }


        const orders = await Order.find({
            user: req.user._id,
        }).sort({
            createdAt: -1,
        });


        return res.status(200).json(
            orders
        );

    } catch (error) {
        console.error(
            "Get my orders error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to get your orders",
        });
    }
};


// ==========================================
// GET SINGLE ORDER
// Admin only with current routes
// ==========================================

export const getOrderById = async (
    req,
    res
) => {
    try {
        if (
            !mongoose.isValidObjectId(
                req.params.id
            )
        ) {
            return res.status(400).json({
                message:
                    "Invalid order ID",
            });
        }


        const order = await Order.findById(
            req.params.id
        ).populate(
            "user",
            "firstName lastName email phone"
        );


        if (!order) {
            return res.status(404).json({
                message:
                    "Order not found",
            });
        }


        return res.status(200).json(
            order
        );

    } catch (error) {
        console.error(
            "Get order error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to get order",
        });
    }
};


// ==========================================
// UPDATE ORDER STATUS
// Admin only
// ==========================================

export const updateOrderStatus = async (
    req,
    res
) => {
    try {
        if (
            !mongoose.isValidObjectId(
                req.params.id
            )
        ) {
            return res.status(400).json({
                message:
                    "Invalid order ID",
            });
        }


        const {
            status,
        } = req.body;


        if (
            !VALID_STATUSES.includes(status)
        ) {
            return res.status(400).json({
                message:
                    "Invalid order status",
            });
        }


        const updatedOrder =
            await Order.findByIdAndUpdate(
                req.params.id,
                {
                    status,
                },
                {
                    new: true,
                    runValidators: true,
                }
            );


        if (!updatedOrder) {
            return res.status(404).json({
                message:
                    "Order not found",
            });
        }


        return res.status(200).json({
            message:
                "Order status updated successfully",

            order: updatedOrder,
        });

    } catch (error) {
        console.error(
            "Update order status error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to update order status",
        });
    }
};