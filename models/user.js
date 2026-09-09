import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        phone: {
            type: String,
            required: true,
            trim: true,
        },

        password: {
            type: String,
            required: true,
        },

        isAdmin: {
            type: Boolean,
            default: false,
        },

        isBlocked: {
            type: Boolean,
            default: false,
        },

        isEmailVerified: {
            type: Boolean,
            default: false,
        },

        image: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model("User", userSchema);

export default User;