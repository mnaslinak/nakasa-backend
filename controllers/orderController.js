import mongoose from "mongoose";
import Product from "../models/product.js";
import supabase from "../config/supabase.js";

const BUCKET = "images";

const createFileName = (originalName = "product-image") => {
  const safeName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return `${Date.now()}-${safeName}`;
};

const getStoragePathFromUrl = (imageUrl) => {
  if (!imageUrl) return null;

  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = imageUrl.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(imageUrl.slice(index + marker.length));
  } catch {
    return null;
  }
};

const deleteImageFromSupabase = async (imageUrl) => {
  const path = getStoragePathFromUrl(imageUrl);

  if (!path) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error("Supabase image delete error:", error.message);
  }
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1" || value === "on";
};

// ==========================================
// GET ALL PRODUCTS
// ==========================================
export const getProducts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const requestedLimit = parseInt(req.query.limit, 10) || 12;
    const limit = Math.min(Math.max(requestedLimit, 1), 100);

    const skip = (page - 1) * limit;

    const [totalProducts, products] = await Promise.all([
      Product.countDocuments(),
      Product.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const totalPages = Math.max(Math.ceil(totalProducts / limit), 1);

    res.status(200).json({
      products,
      currentPage: page,
      totalPages,
      totalProducts,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get products",
      error: error.message,
    });
  }
};

// ==========================================
// GET SINGLE PRODUCT BY ID
// ==========================================
export const getProductById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get product",
      error: error.message,
    });
  }
};

// ==========================================
// CREATE PRODUCT
// ==========================================
export const createProduct = async (req, res) => {
  let uploadedImageUrl = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Product image is required",
      });
    }

    const price = Number(req.body.price);
    const oldPrice = parseOptionalNumber(req.body.oldPrice);

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        message: "Price must be a valid positive number",
      });
    }

    if (oldPrice !== undefined && oldPrice < 0) {
      return res.status(400).json({
        message: "Old price cannot be negative",
      });
    }

    const fileName = createFileName(req.file.originalname);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({
        message: "Failed to upload image",
        error: uploadError.message,
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    uploadedImageUrl = publicUrlData?.publicUrl;

    if (!uploadedImageUrl) {
      await deleteImageFromSupabase(
        `https://placeholder/storage/v1/object/public/${BUCKET}/${fileName}`
      );

      return res.status(500).json({
        message: "Failed to generate image URL",
      });
    }

    const product = await Product.create({
      name: req.body.name?.trim(),
      description: req.body.description?.trim(),
      price,
      oldPrice,
      category: req.body.category?.trim(),
      gender: req.body.gender,
      brand: req.body.brand?.trim() || "NAKASA",
      image: uploadedImageUrl,
      featured: parseBoolean(req.body.featured),
      rating: parseOptionalNumber(req.body.rating),
      discount: parseOptionalNumber(req.body.discount) ?? 0,
    });

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    if (uploadedImageUrl) {
      await deleteImageFromSupabase(uploadedImageUrl);
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid product data",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// ==========================================
// DELETE PRODUCT
// ==========================================
export const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    if (product.image) {
      await deleteImageFromSupabase(product.image);
    }

    res.status(200).json({
      message: "Product deleted successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

// ==========================================
// UPDATE PRODUCT
// ==========================================
export const updateProduct = async (req, res) => {
  let newImageUrl = null;

  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (req.body.price !== undefined && req.body.price !== "") {
      const price = Number(req.body.price);

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          message: "Price must be a valid positive number",
        });
      }

      product.price = price;
    }

    if (req.body.oldPrice !== undefined) {
      product.oldPrice = parseOptionalNumber(req.body.oldPrice);
    }

    if (req.body.name !== undefined) {
      product.name = req.body.name.trim();
    }

    if (req.body.description !== undefined) {
      product.description = req.body.description.trim();
    }

    if (req.body.category !== undefined) {
      product.category = req.body.category.trim();
    }

    if (req.body.brand !== undefined) {
      product.brand = req.body.brand.trim() || "NAKASA";
    }

    if (req.body.gender !== undefined) {
      product.gender = req.body.gender;
    }

    if (req.body.featured !== undefined) {
      product.featured = parseBoolean(req.body.featured);
    }

    if (req.body.rating !== undefined) {
      product.rating = parseOptionalNumber(req.body.rating);
    }

    if (req.body.discount !== undefined) {
      product.discount = parseOptionalNumber(req.body.discount) ?? 0;
    }

    const oldImageUrl = product.image;

    if (req.file) {
      const fileName = createFileName(req.file.originalname);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        return res.status(500).json({
          message: "Failed to upload new image",
          error: uploadError.message,
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      newImageUrl = publicUrlData?.publicUrl;

      if (!newImageUrl) {
        return res.status(500).json({
          message: "Failed to generate new image URL",
        });
      }

      product.image = newImageUrl;
    }

    const updatedProduct = await product.save();

    if (newImageUrl && oldImageUrl) {
      await deleteImageFromSupabase(oldImageUrl);
    }

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    if (newImageUrl) {
      await deleteImageFromSupabase(newImageUrl);
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid product data",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Failed to update product",
      error: error.message,
    });
  }
};
