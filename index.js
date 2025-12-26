/**
 * GLOM STORE - ALL IN ONE BACKEND
 * Single index.js – FULL VERSION
 */

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

dotenv.config();
const app = express();

/* ===================== BASIC ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

/* ===================== DB ===================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

/* ===================== MODELS ===================== */
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  verified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

const Product = mongoose.model("Product", new mongoose.Schema({
  title: String,
  description: String,
  images: [String],
  category: String,
  plans: [{
    name: String,
    price: Number,
    keys: [String]
  }]
}));

const Coupon = mongoose.model("Coupon", new mongoose.Schema({
  code: { type: String, unique: true },
  type: String, // percent | amount
  value: Number,
  expiresAt: Date,
  active: { type: Boolean, default: true }
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  planName: String,
  price: Number,
  coupon: Object,
  finalPrice: Number,
  proofImage: String,
  proofHash: String,
  status: {
    type: String,
    enum: ["pending", "pending_review", "approved", "rejected"],
    default: "pending"
  },
  deliveredKey: String,
  createdAt: { type: Date, default: Date.now }
}));

/* ===================== UTILS ===================== */
function hashFile(p) {
  const b = fs.readFileSync(p);
  return crypto.createHash("sha256").update(b).digest("hex");
}

/* ===================== UPLOAD ===================== */
fs.mkdirSync("uploads/proofs", { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/proofs",
    filename: (_, file, cb) =>
      cb(null, Date.now() + path.extname(file.originalname))
  })
});

/* ===================== AUTH (BASIC) ===================== */
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "INVALID" });

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ error: "EXISTS" });

  const user = await User.create({ name, email, password });
  res.json({ userId: user._id });
});

/* ===================== STORE ===================== */
app.get("/api/store/products", async (_, res) => {
  res.json(await Product.find());
});

app.get("/api/store/product/:id", async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).end();
  res.json(p);
});

/* ===================== CHECKOUT ===================== */
app.post("/api/checkout", async (req, res) => {
  const { userId, productId, planName, couponCode } = req.body;

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });

  const plan = product.plans.find(p => p.name === planName);
  if (!plan) return res.status(400).json({ error: "PLAN_NOT_FOUND" });

  let finalPrice = plan.price;
  let coupon = null;

  if (couponCode) {
    const c = await Coupon.findOne({
      code: couponCode,
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
    });

    if (c) {
      coupon = { code: c.code, type: c.type, value: c.value };
      if (c.type === "percent") finalPrice -= finalPrice * (c.value / 100);
      if (c.type === "amount") finalPrice -= c.value;
      if (finalPrice < 0) finalPrice = 0;
    }
  }

  const order = await Order.create({
    user: userId || null,
    product: product._id,
    planName,
    price: plan.price,
    coupon,
    finalPrice
  });

  res.json({ orderId: order._id });
});

/* ===================== UPLOAD PROOF ===================== */
app.post("/api/orders/:id/proof", upload.single("proof"), async (req, res) => {
  const order = await Order.findById(req.params.id).populate("product");
  if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });

  const fullPath = req.file.path;
  const imgHash = hashFile(fullPath);

  const duplicate = await Order.findOne({ proofHash: imgHash });

  order.proofImage = "/" + fullPath;
  order.proofHash = imgHash;
  order.status = "pending_review";
  await order.save();

  /* Discord Webhook */
  if (process.env.DISCORD_WEBHOOK_URL) {
    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "🧾 طلب جديد",
          color: duplicate ? 0xf59e0b : 0x22c55e,
          fields: [
            { name: "الطلب", value: String(order._id) },
            { name: "المنتج", value: order.product.title },
            { name: "الفترة", value: order.planName },
            { name: "السعر", value: `${order.finalPrice}$` },
            { name: "الحالة", value: "بانتظار المراجعة" }
          ],
          image: { url: order.proofImage }
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 3, label: "قبول", custom_id: `approve_${order._id}` },
            { type: 2, style: 4, label: "رفض", custom_id: `reject_${order._id}` }
          ]
        }]
      })
    });
  }

  res.json({ success: true });
});

/* ===================== ADMIN ===================== */
app.post("/api/admin/orders/:id/approve", async (req, res) => {
  const order = await Order.findById(req.params.id).populate("product");
  if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });

  const plan = order.product.plans.find(p => p.name === order.planName);
  if (!plan || !plan.keys.length)
    return res.status(400).json({ error: "NO_KEYS" });

  const key = plan.keys.shift();
  order.deliveredKey = key;
  order.status = "approved";
  await order.product.save();
  await order.save();

  res.json({ key });
});

app.post("/api/admin/orders/:id/reject", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });
  order.status = "rejected";
  await order.save();
  res.json({ success: true });
});

/* ===================== DASHBOARD ===================== */
app.get("/api/admin/overview", async (_, res) => {
  const total = await Order.countDocuments();
  const approved = await Order.countDocuments({ status: "approved" });
  const pending = await Order.countDocuments({ status: "pending_review" });
  const rejected = await Order.countDocuments({ status: "rejected" });
  res.json({ total, approved, pending, rejected });
});

/* ===================== START ===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 GLOM Store running on", PORT));
