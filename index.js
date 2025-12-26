/**
 * GLOM STORE - ALL IN ONE BACKEND
 * Single index.js (no external routes)
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
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

/* ===================== MODELS ===================== */
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    verified: { type: Boolean, default: false },
  })
);

const Product = mongoose.model(
  "Product",
  new mongoose.Schema({
    title: String,
    description: String,
    images: [String],
    category: String,
    plans: [
      {
        name: String,
        price: Number, // USD
        keys: [String],
      },
    ],
  })
);

const Coupon = mongoose.model(
  "Coupon",
  new mongoose.Schema({
    code: { type: String, unique: true },
    type: String, // percent | amount
    value: Number,
    expiresAt: Date,
    active: { type: Boolean, default: true },
  })
);

const Order = mongoose.model(
  "Order",
  new mongoose.Schema({
    user: mongoose.Schema.Types.ObjectId,
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    planName: String,
    price: Number, // base USD
    coupon: Object,
    finalPrice: Number, // USD
    proofImage: String,
    proofHash: String,
    autoCheck: {
      status: { type: String, default: "pending" }, // auto_safe | needs_manual | pending
      reason: String,
      currencyDetected: String,
      amountDetectedUSD: Number,
    },
    status: { type: String, default: "pending" }, // pending | pending_review | approved | rejected
    deliveredKey: String,
    createdAt: { type: Date, default: Date.now },
  })
);

/* ===================== UTILS ===================== */
function hashFile(p) {
  const b = fs.readFileSync(p);
  return crypto.createHash("sha256").update(b).digest("hex");
}

const USD_TO_SAR = 3.75;
function toUSD(amount, currency) {
  if (!amount) return 0;
  return currency === "SAR" ? amount / USD_TO_SAR : amount;
}

/**
 * Auto-check (غير قاطع):
 * - لا يرفض أبداً
 * - يحاول تقدير بسيط (بدون OCR خارجي)
 * - إذا السعر قريب/مساوي ⇒ auto_safe
 * - غير ذلك ⇒ needs_manual
 */
function autoCheckProof({ expectedUSD }) {
  // بدون OCR فعلي (عشان الاستقرار)
  // نتركه conservative
  if (!expectedUSD || expectedUSD <= 0) {
    return { status: "needs_manual", reason: "missing_expected_price" };
  }
  // بما إن ما نقرأ مبلغ فعلي من الصورة هنا
  // نعلّم الطلب يحتاج مراجعة بشرية
  return {
    status: "needs_manual",
    reason: "no_ocr_enabled",
    currencyDetected: null,
    amountDetectedUSD: null,
  };
}

/* ===================== UPLOAD ===================== */
fs.mkdirSync("uploads/proofs", { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/proofs",
    filename: (req, file, cb) =>
      cb(null, Date.now() + path.extname(file.originalname)),
  }),
});

/* ===================== STORE ===================== */
app.get("/api/store/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.get("/api/store/product/:id", async (req, res) => {
  const p = await Product.findById(req.params.id);
  res.json(p);
});

// معاينة كوبون (اختياري للفرونت)
app.get("/api/store/coupon/:code", async (req, res) => {
  const c = await Coupon.findOne({
    code: req.params.code.toUpperCase(),
    active: true,
  });
  if (!c || (c.expiresAt && c.expiresAt < new Date()))
    return res.status(404).json({ error: "INVALID_COUPON" });
  res.json({ code: c.code, type: c.type, value: c.value });
});

/* ===================== CHECKOUT ===================== */
app.post("/api/checkout", async (req, res) => {
  const { productId, planName, couponCode } = req.body;
  const product = await Product.findById(productId);
  if (!product)
    return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });

  const plan = product.plans.find((p) => p.name === planName);
  if (!plan) return res.status(400).json({ error: "PLAN_NOT_FOUND" });

  let finalPrice = Number(plan.price || 0);
  let coupon = null;

  if (couponCode) {
    const c = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      active: true,
    });
    if (c && (!c.expiresAt || c.expiresAt > new Date())) {
      coupon = { code: c.code, type: c.type, value: c.value };
      if (c.type === "percent")
        finalPrice -= finalPrice * (c.value / 100);
      if (c.type === "amount") finalPrice -= c.value;
      if (finalPrice < 0) finalPrice = 0;
    }
  }

  const order = await Order.create({
    product: product._id,
    planName,
    price: Number(plan.price || 0),
    coupon,
    finalPrice: Number(finalPrice.toFixed(2)),
    status: "pending",
  });

  res.json({ orderId: order._id });
});

/* ===================== UPLOAD PROOF ===================== */
app.post(
  "/api/orders/:id/proof",
  upload.single("proof"),
  async (req, res) => {
    const order = await Order.findById(req.params.id).populate("product");
    if (!order)
      return res.status(404).json({ error: "ORDER_NOT_FOUND" });

    const fullPath = `uploads/proofs/${req.file.filename}`;
    const imgHash = hashFile(fullPath);

    const duplicate = await Order.findOne({ proofHash: imgHash });

    order.proofImage = "/uploads/proofs/" + req.file.filename;
    order.proofHash = imgHash;

    // auto-check (غير قاطع)
    const ac = autoCheckProof({ expectedUSD: order.finalPrice });
    order.autoCheck = ac;
    order.status = "pending_review";
    await order.save();

    /* Discord Webhook */
    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "🧾 طلب جديد - إثبات تحويل",
              color: duplicate ? 0xf59e0b : 0x7c3aed,
              fields: [
                { name: "Order ID", value: String(order._id) },
                { name: "Product", value: order.product.title },
                { name: "Plan", value: order.planName },
                { name: "Final Price (USD)", value: `$${order.finalPrice}` },
                {
                  name: "Auto-Check",
                  value:
                    ac.status === "auto_safe"
                      ? "Auto-Safe"
                      : "Needs Manual Review",
                },
                {
                  name: "Duplicate Image",
                  value: duplicate ? "Yes" : "No",
                },
              ],
              image: { url: order.proofImage },
            },
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3,
                  label: "قبول وتسليم",
                  custom_id: `approve_${order._id}`,
                },
                {
                  type: 2,
                  style: 4,
                  label: "رفض",
                  custom_id: `reject_${order._id}`,
                },
              ],
            },
          ],
        }),
      });
    }

    res.json({ success: true });
  }
);

/* ===================== ADMIN ===================== */
app.post("/api/admin/orders/:id/approve", async (req, res) => {
  const order = await Order.findById(req.params.id).populate("product");
  if (!order)
    return res.status(404).json({ error: "ORDER_NOT_FOUND" });

  const plan = order.product.plans.find(
    (p) => p.name === order.planName
  );
  if (!plan || !plan.keys || !plan.keys.length)
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
  if (!order)
    return res.status(404).json({ error: "ORDER_NOT_FOUND" });
  order.status = "rejected";
  await order.save();
  res.json({ success: true });
});

/* ===================== DASHBOARD ===================== */
app.get("/api/admin/overview", async (req, res) => {
  const total = await Order.countDocuments();
  const approved = await Order.countDocuments({ status: "approved" });
  const pending = await Order.countDocuments({ status: "pending_review" });
  const rejected = await Order.countDocuments({ status: "rejected" });
  res.json({ total, approved, pending, rejected });
});

/* ===================== START ===================== */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 GLOM Store running on", PORT));
