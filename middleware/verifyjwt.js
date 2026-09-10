import jwt from "jsonwebtoken";
import User from "../models/user.js";

export default async function verifyJWT(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        if (!process.env.JWT_SECRET_KEY) {
            return res.status(500).json({
                message: "JWT secret is not configured",
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET_KEY
        );

     
    }
}