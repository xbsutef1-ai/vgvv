import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  planName: {
    type: String,
    required: true
  },

  price: Number,

  couponCode: {
    type: String,
    default: null
  },

  discountAmount: {
    type: Number,
    default: 0
  },

  finalPrice: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: [
      "pending",
      "waiting_proof",
      "approved",
      "rejected",
      "completed",
      "no_stock"
    ],
    default: "pending"
  },

  proofImage: {
    type: String,
    default: null
  },

  deliveredKey: {
    type: String,
    default: null
  }

}, { timestamps: true });

export default mongoose.model("Order", OrderSchema);
