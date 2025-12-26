import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
  name: String,
  slug: String
});

export default mongoose.model("Category", CategorySchema);
