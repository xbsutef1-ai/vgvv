import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    uppercase: true,
    required: true
  },

  type: {
    type: String,
    enum: ["percent", "amount"],
    required: true
  },

  value: {
    type: Number,
    required: true
  },

  appliesToPlan: {
    type: String,
    default: null // لو null = كل الفترات
  },

  expiresAt: {
    type: Date,
    required: true
  },

  usageLimit: {
    type: Number,
    default: 0 // 0 = غير محدود
  },

  usedCount: {
    type: Number,
    default: 0
  },

  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.model("Coupon", CouponSchema);
