import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: String,
  price: Number,
  keys: [String]
});

const productSchema = new mongoose.Schema({
  title: String,
  description: String,
  images: [String],
  categorySlug: String,
  plans: [planSchema],
  active: { type: Boolean, default: true }
});

export default mongoose.model("Product", productSchema);
