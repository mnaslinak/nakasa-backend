import dns from "dns";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import supabase from "./config/supabase.js";
import orderRoutes from "./routes/orderRoutes.js";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.get("/", (req, res) => {
  res.send("NAKASA Backend is running 🚀");
});

const PORT = process.env.PORT || 5000;
console.log("Supabase connected:", !!supabase);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});