import dns from "dns";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import supabase from "./config/supabase.js";
import userRoutes from "./routes/userRoutes.js";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(
  cors({
    origin: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.get("/", (req, res) => {
  res.status(200).json({
    message: "NAKASA Backend is running 🚀",
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Image must be 5MB or smaller",
      });
    }

    return res.status(400).json({
      message: "Invalid image upload",
    });
  }

  res.status(500).json({
    message: "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Supabase client initialized:", Boolean(supabase));
});
