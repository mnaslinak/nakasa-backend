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


        // Validate required fields

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


        // Validate input types

        if (
            typeof email !== "string" ||
            typeof firstName !== "string" ||
            typeof lastName !== "string" ||
            typeof phone !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Invalid input data",
            });
        }


        const normalizedEmail = email
            .toLowerCase()
            .trim();


        // Check whether the user already exists

        const existingUser = await User.findOne({
            email: normalizedEmail,
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


        // Create customer account
        // Users cannot make themselves admins during registration

        const newUser = new User({
            email: normalizedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            password: passwordHash,
            isAdmin: false,
            isBlocked: false,
        });


        await newUser.save();


        return res.status(201).json({
            message: "User created successfully",
        });

    } catch (error) {
        console.error("Register error:", error);


        // Handle duplicate email errors from MongoDB

        if (error.code === 11000) {
            return res.status(409).json({
                message: "User already exists",
            });
        }


        return res.status(500).json({
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


        // Validate required fields

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }


        // Validate input types

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Invalid email or password",
            });
        }


        const normalizedEmail = email
            .toLowerCase()
            .trim();


        // Find user

        const user = await User.findOne({
            email: normalizedEmail,
        });


        // Use one message for both incorrect email and password

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }


        // Check whether the account is blocked

        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account has been blocked",
            });
        }


        // Check password

        const passwordValid = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordValid) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }


        // Check JWT configuration

        if (!process.env.JWT_SECRET_KEY) {
            console.error(
                "JWT_SECRET_KEY is not configured"
            );

            return res.status(500).json({
                message: "Authentication configuration error",
            });
        }


        // Create JWT containing only the user ID

        const token = jwt.sign(
            {
                id: user._id,
            },
            process.env.JWT_SECRET_KEY,
            {
                expiresIn: "24h",
            }
        );


        // Login response

        return res.status(200).json({
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
                isBlocked: user.isBlocked,
                isEmailVerified: user.isEmailVerified,
            },
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error",
        });
    }
}