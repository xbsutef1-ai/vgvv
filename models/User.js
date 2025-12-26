import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,
    lowercase: true
  },
  password: String,

  verified: {
    type: Boolean,
    default: false
  },

  verifyCode: String,
  verifyExpires: Date

}, { timestamps: true });

export default mongoose.model("User", UserSchema);
