import express from "express";
import dotenv from "dotenv";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";

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