import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";


// ===============================
// REGISTER USER
// ===============================

export async function createUser(req, res) {
    try {
        const {
            email,
            firstName,
            lastName,
            phone,
            password,
        } = req.body;


        // Check required fields

        if (
            !email ||
            !firstName ||
            !lastName ||
            !phone ||
            !password
        ) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }


        // Check existing user

        const existingUser = await User.findOne({
            email: email.toLowerCase(),
        });

        if (existingUser) {
            return res.status(409).json({
                message: "User already exists",
            });
        }


        // Hash password

        const passwordHash = await bcrypt.hash(
            password,
            10
        );


        // Create user

        const newUser = new User({
            email: email.toLowerCase().trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            password: passwordHash,
        });


        await newUser.save();


        // Success response

        res.status(201).json({
            message: "User created successfully",
        });

    } catch (error) {

        console.error("Register error:", error);

        res.status(500).json({
            message: "Internal server error",
        });
    }
}


// ===============================
// LOGIN USER
// ===============================

export async function loginUser(req, res) {
    try {

        const {
            email,
            password,
        } = req.body;


        // Validate fields

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }


        // Find user

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
        });


        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }


        // Check blocked user

        if (user.isBlocked) {
            return res.status(403).json({
                message: "User is blocked",
            });
        }


        // Check password

        const passwordValid = await bcrypt.compare(
            password,
            user.password
        );


        if (!passwordValid) {
            return res.status(401).json({
                message: "Invalid password",
            });
        }


        // Create JWT

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                isAdmin: user.isAdmin,
                isBlocked: user.isBlocked,
                isEmailVerified: user.isEmailVerified,
                image: user.image,
            },
            process.env.JWT_SECRET_KEY,
            {
                expiresIn: "24h",
            }
        );


        // Login response

        res.json({
            message: "Login successful",

            token,

            isAdmin: user.isAdmin,

            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                image: user.image || "",
                isAdmin: user.isAdmin,
                isEmailVerified: user.isEmailVerified,
            },
        });

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            message: "Internal server error",
        });
    }
}