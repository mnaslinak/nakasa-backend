import mongoose from "mongoose";
import Product from "../models/product.js";
import supabase from "../config/supabase.js";

const BUCKET = "images";

// ==========================================
// HELPER: CREATE SAFE IMAGE FILE NAME
// ==========================================
const createFileName = (originalName = "product-image") => {
  const safeName = originalName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;
};

// ==========================================
// HELPER: GET SUPABASE PATH FROM URL
// ==========================================
const getStoragePathFromUrl = (imageUrl) => {
  if (!imageUrl) return null;

  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;

    const index = imageUrl.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      imageUrl.slice(index + marker.length)
    );
  } catch {
    return null;
  }
};

// ==========================================
// HELPER: DELETE IMAGE FROM SUPABASE
// ==========================================
const deleteImageFromSupabase = async (imageUrl) => {
  const path = getStoragePathFromUrl(imageUrl);

  if (!path) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error(
      "Supabase image delete error:",
      error.message
    );
  }
};

// ==========================================
// HELPER: OPTIONAL NUMBER
// ==========================================
const parseOptionalNumber = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : undefined;
};

// ==========================================
// HELPER: BOOLEAN
// ==========================================
const parseBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  return (
    value === "true" ||
    value === "1" ||
    value === "on"
  );
};

// ==========================================
// HELPER: UPLOAD IMAGE TO SUPABASE
// ==========================================
const uploadImageToSupabase = async (file) => {
  const fileName = createFileName(
    file.originalname
  );

  const { error: uploadError } =
    await supabase.storage
      .from(BUCKET)
      .upload(
        fileName,
        file.buffer,
        {
          contentType: file.mimetype,
          upsert: false,
        }
      );

  if (uploadError) {
    throw new Error(
      `Failed to upload ${file.originalname}: ${uploadError.message}`
    );
  }

  const { data: publicUrlData } =
    supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

  const publicUrl =
    publicUrlData?.publicUrl;

  if (!publicUrl) {
    const temporaryUrl =
      `https://placeholder/storage/v1/object/public/${BUCKET}/${fileName}`;

    await deleteImageFromSupabase(
      temporaryUrl
    );

    throw new Error(
      `Failed to generate image URL for ${file.originalname}`
    );
  }

  return publicUrl;
};

// ==========================================
// GET ALL PRODUCTS
// ==========================================
export const getProducts = async (
  req,
  res
) => {
  try {
    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1
    );

    const requestedLimit =
      parseInt(req.query.limit, 10) || 12;

    const limit = Math.min(
      Math.max(requestedLimit, 1),
      100
    );

    const skip = (page - 1) * limit;

    const [
      totalProducts,
      products,
    ] = await Promise.all([
      Product.countDocuments(),

      Product.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    const totalPages = Math.max(
      Math.ceil(
        totalProducts / limit
      ),
      1
    );

    return res.status(200).json({
      products,
      currentPage: page,
      totalPages,
      totalProducts,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Failed to get products",

      error: error.message,
    });
  }
};

// ==========================================
// GET SINGLE PRODUCT
// ==========================================
export const getProductById = async (
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
          "Invalid product ID",
      });
    }

    const product =
      await Product.findById(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found",
      });
    }

    return res
      .status(200)
      .json(product);
  } catch (error) {
    return res.status(500).json({
      message:
        "Failed to get product",

      error: error.message,
    });
  }
};

// ==========================================
// CREATE SINGLE PRODUCT
// ==========================================
export const createProduct = async (
  req,
  res
) => {
  let uploadedImageUrl = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        message:
          "Product image is required",
      });
    }

    const price =
      Number(req.body.price);

    const oldPrice =
      parseOptionalNumber(
        req.body.oldPrice
      );

    const stock =
      parseOptionalNumber(
        req.body.stock
      ) ?? 0;

    const rating =
      parseOptionalNumber(
        req.body.rating
      ) ?? 0;

    const discount =
      parseOptionalNumber(
        req.body.discount
      ) ?? 0;

    // PRICE
    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({
        message:
          "Price must be a valid positive number",
      });
    }

    // OLD PRICE
    if (
      oldPrice !== undefined &&
      oldPrice < 0
    ) {
      return res.status(400).json({
        message:
          "Old price cannot be negative",
      });
    }

    // STOCK
    if (
      !Number.isFinite(stock) ||
      stock < 0
    ) {
      return res.status(400).json({
        message:
          "Stock cannot be negative",
      });
    }

    // RATING
    if (
      !Number.isFinite(rating) ||
      rating < 0 ||
      rating > 5
    ) {
      return res.status(400).json({
        message:
          "Rating must be between 0 and 5",
      });
    }

    // DISCOUNT
    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount > 100
    ) {
      return res.status(400).json({
        message:
          "Discount must be between 0 and 100",
      });
    }

    uploadedImageUrl =
      await uploadImageToSupabase(
        req.file
      );

    const product =
      await Product.create({
        name:
          req.body.name?.trim(),

        description:
          req.body.description?.trim(),

        price,

        oldPrice,

        category:
          req.body.category?.trim(),

        gender:
          req.body.gender?.trim(),

        brand:
          req.body.brand?.trim() ||
          "NAKASA",

        image:
          uploadedImageUrl,

        stock,

        featured:
          parseBoolean(
            req.body.featured
          ),

        rating,

        discount,
      });

    return res.status(201).json({
      message:
        "Product created successfully",

      product,
    });
  } catch (error) {
    if (uploadedImageUrl) {
      await deleteImageFromSupabase(
        uploadedImageUrl
      );
    }

    if (
      error.name ===
        "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message:
          "Invalid product data",

        error: error.message,
      });
    }

    console.error(
      "Create product error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to create product",

      error: error.message,
    });
  }
};

// ==========================================
// BULK CREATE PRODUCTS
// ==========================================
export const createBulkProducts = async (
  req,
  res
) => {
  const uploadedImageUrls = [];

  try {
    // ======================================
    // READ PRODUCTS FROM FORMDATA
    // ======================================
    let products;

    try {
      products = JSON.parse(
        req.body.products || "[]"
      );
    } catch {
      return res.status(400).json({
        message:
          "Invalid products data",
      });
    }

    if (
      !Array.isArray(products) ||
      products.length === 0
    ) {
      return res.status(400).json({
        message:
          "No products received",
      });
    }

    if (products.length > 100) {
      return res.status(400).json({
        message:
          "Maximum 100 products can be imported at once",
      });
    }

    if (
      !req.files ||
      req.files.length === 0
    ) {
      return res.status(400).json({
        message:
          "Product images are required",
      });
    }

    // ======================================
    // BUILD IMAGE LOOKUP
    // ======================================
    const fileMap = new Map();

    req.files.forEach((file) => {
      const key =
        file.originalname
          .trim()
          .toLowerCase();

      fileMap.set(key, file);
    });

    const productsToInsert = [];

    // ======================================
    // PROCESS EACH PRODUCT
    // ======================================
    for (
      let index = 0;
      index < products.length;
      index += 1
    ) {
      const product =
        products[index];

      const rowNumber =
        index + 2;

      const productName =
        product.name?.trim();

      const description =
        product.description?.trim();

      const category =
        product.category?.trim();

      const gender =
        product.gender?.trim();

      const brand =
        product.brand?.trim() ||
        "NAKASA";

      const imageName =
        product.image?.trim();

      // REQUIRED FIELDS
      if (!productName) {
        throw new Error(
          `Row ${rowNumber}: Product name is required`
        );
      }

      if (!description) {
        throw new Error(
          `Row ${rowNumber}: Description is required`
        );
      }

      if (!category) {
        throw new Error(
          `Row ${rowNumber}: Category is required`
        );
      }

      if (!gender) {
        throw new Error(
          `Row ${rowNumber}: Gender is required`
        );
      }

      if (!imageName) {
        throw new Error(
          `Row ${rowNumber}: Image filename is required`
        );
      }

      // ======================================
      // NUMERIC VALUES
      // ======================================
      const price =
        Number(product.price);

      const oldPrice =
        product.oldPrice !== null &&
        product.oldPrice !== undefined &&
        product.oldPrice !== ""
          ? Number(product.oldPrice)
          : undefined;

      const stock =
        product.stock !== undefined &&
        product.stock !== ""
          ? Number(product.stock)
          : 0;

      const rating =
        product.rating !== undefined &&
        product.rating !== ""
          ? Number(product.rating)
          : 0;

      const discount =
        product.discount !== undefined &&
        product.discount !== ""
          ? Number(product.discount)
          : 0;

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        throw new Error(
          `Row ${rowNumber}: Invalid price`
        );
      }

      if (
        oldPrice !== undefined &&
        (
          !Number.isFinite(oldPrice) ||
          oldPrice < 0
        )
      ) {
        throw new Error(
          `Row ${rowNumber}: Invalid old price`
        );
      }

      if (
        !Number.isFinite(stock) ||
        stock < 0
      ) {
        throw new Error(
          `Row ${rowNumber}: Invalid stock`
        );
      }

      if (
        !Number.isFinite(rating) ||
        rating < 0 ||
        rating > 5
      ) {
        throw new Error(
          `Row ${rowNumber}: Rating must be between 0 and 5`
        );
      }

      if (
        !Number.isFinite(discount) ||
        discount < 0 ||
        discount > 100
      ) {
        throw new Error(
          `Row ${rowNumber}: Discount must be between 0 and 100`
        );
      }

      // ======================================
      // FIND MATCHING IMAGE
      // ======================================
      const imageKey =
        imageName.toLowerCase();

      const imageFile =
        fileMap.get(imageKey);

      if (!imageFile) {
        throw new Error(
          `Row ${rowNumber}: Image "${imageName}" was not received`
        );
      }

      // ======================================
      // UPLOAD IMAGE
      // ======================================
      const uploadedImageUrl =
        await uploadImageToSupabase(
          imageFile
        );

      uploadedImageUrls.push(
        uploadedImageUrl
      );

      // ======================================
      // BUILD MONGODB PRODUCT
      // ======================================
      productsToInsert.push({
        name: productName,

        description,

        price,

        oldPrice,

        category,

        gender,

        brand,

        stock,

        rating,

        discount,

        featured:
          parseBoolean(
            product.featured
          ),

        image:
          uploadedImageUrl,
      });
    }

    // ======================================
    // INSERT PRODUCTS INTO MONGODB
    // ======================================
    const createdProducts =
      await Product.insertMany(
        productsToInsert
      );

    return res.status(201).json({
      message:
        "Products imported successfully",

      count:
        createdProducts.length,

      products:
        createdProducts,
    });
  } catch (error) {
    console.error(
      "Bulk product upload error:",
      error
    );

    // ======================================
    // CLEANUP SUPABASE IF IMPORT FAILS
    // ======================================
    if (
      uploadedImageUrls.length > 0
    ) {
      await Promise.allSettled(
        uploadedImageUrls.map(
          (imageUrl) =>
            deleteImageFromSupabase(
              imageUrl
            )
        )
      );
    }

    if (
      error.name ===
        "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message:
          "Invalid product data",

        error: error.message,
      });
    }

    return res.status(500).json({
      message:
        "Bulk product upload failed",

      error: error.message,
    });
  }
};

// ==========================================
// UPDATE PRODUCT
// ==========================================
export const updateProduct = async (
  req,
  res
) => {
  let newImageUrl = null;

  try {
    if (
      !mongoose.isValidObjectId(
        req.params.id
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid product ID",
      });
    }

    const product =
      await Product.findById(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found",
      });
    }

    // PRICE
    if (
      req.body.price !==
        undefined &&
      req.body.price !== ""
    ) {
      const price =
        Number(req.body.price);

      if (
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          message:
            "Price must be a valid positive number",
        });
      }

      product.price = price;
    }

    // OLD PRICE
    if (
      req.body.oldPrice !==
      undefined
    ) {
      const oldPrice =
        parseOptionalNumber(
          req.body.oldPrice
        );

      if (
        oldPrice !== undefined &&
        oldPrice < 0
      ) {
        return res.status(400).json({
          message:
            "Old price cannot be negative",
        });
      }

      product.oldPrice =
        oldPrice;
    }

    // NAME
    if (
      req.body.name !== undefined
    ) {
      product.name =
        req.body.name.trim();
    }

    // DESCRIPTION
    if (
      req.body.description !==
      undefined
    ) {
      product.description =
        req.body.description.trim();
    }

    // CATEGORY
    if (
      req.body.category !==
      undefined
    ) {
      product.category =
        req.body.category.trim();
    }

    // BRAND
    if (
      req.body.brand !== undefined
    ) {
      product.brand =
        req.body.brand.trim() ||
        "NAKASA";
    }

    // GENDER
    if (
      req.body.gender !== undefined
    ) {
      product.gender =
        req.body.gender.trim();
    }

    // STOCK
    if (
      req.body.stock !== undefined
    ) {
      const stock =
        Number(req.body.stock);

      if (
        !Number.isFinite(stock) ||
        stock < 0
      ) {
        return res.status(400).json({
          message:
            "Stock cannot be negative",
        });
      }

      product.stock = stock;
    }

    // FEATURED
    if (
      req.body.featured !==
      undefined
    ) {
      product.featured =
        parseBoolean(
          req.body.featured
        );
    }

    // RATING
    if (
      req.body.rating !== undefined
    ) {
      const rating =
        Number(req.body.rating);

      if (
        !Number.isFinite(rating) ||
        rating < 0 ||
        rating > 5
      ) {
        return res.status(400).json({
          message:
            "Rating must be between 0 and 5",
        });
      }

      product.rating =
        rating;
    }

    // DISCOUNT
    if (
      req.body.discount !==
      undefined
    ) {
      const discount =
        Number(
          req.body.discount
        );

      if (
        !Number.isFinite(
          discount
        ) ||
        discount < 0 ||
        discount > 100
      ) {
        return res.status(400).json({
          message:
            "Discount must be between 0 and 100",
        });
      }

      product.discount =
        discount;
    }

    const oldImageUrl =
      product.image;

    // ======================================
    // NEW IMAGE
    // ======================================
    if (req.file) {
      newImageUrl =
        await uploadImageToSupabase(
          req.file
        );

      product.image =
        newImageUrl;
    }

    const updatedProduct =
      await product.save();

    // Delete old image only after
    // MongoDB save succeeds
    if (
      newImageUrl &&
      oldImageUrl
    ) {
      await deleteImageFromSupabase(
        oldImageUrl
      );
    }

    return res.status(200).json({
      message:
        "Product updated successfully",

      product:
        updatedProduct,
    });
  } catch (error) {
    if (newImageUrl) {
      await deleteImageFromSupabase(
        newImageUrl
      );
    }

    if (
      error.name ===
        "ValidationError" ||
      error.name === "CastError"
    ) {
      return res.status(400).json({
        message:
          "Invalid product data",

        error: error.message,
      });
    }

    console.error(
      "Update product error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to update product",

      error: error.message,
    });
  }
};

// ==========================================
// DELETE PRODUCT
// ==========================================
export const deleteProduct = async (
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
          "Invalid product ID",
      });
    }

    const product =
      await Product.findById(
        req.params.id
      );

    if (!product) {
      return res.status(404).json({
        message:
          "Product not found",
      });
    }

    await Product.findByIdAndDelete(
      req.params.id
    );

    if (product.image) {
      await deleteImageFromSupabase(
        product.image
      );
    }

    return res.status(200).json({
      message:
        "Product deleted successfully",

      product,
    });
  } catch (error) {
    return res.status(500).json({
      message:
        "Failed to delete product",

      error: error.message,
    });
  }
};