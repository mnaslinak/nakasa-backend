import mongoose from "mongoose";
const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },

        description: {
            type: String,
            required: true,
        },

        price: {
            type: Number,
            required: true,
        },

        oldPrice: {
            type: Number,
        },

        category: {
            type: String,
            required: true,
        },

        gender: {
            type: String,
            enum: ["Men", "Women", "Unisex"],
            required: true,
        },

        brand: {
            type: String,
            default: "NAKASA",
        },

        // rest of your fields...
    },
    {
        timestamps: true,
    }
);

const Product = mongoose.model("Product", productSchema);

export default Product;