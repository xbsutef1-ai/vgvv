/**
 * GLOM STORE – FULL BACKEND
 * Dashboard (D) + Auth/Email (E) + Proof/OCR/Discord (F)
 */

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import multer from "multer";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import Tesseract from "tesseract.js";

dotenv.config();
const app = express();

/* ================= BASIC ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log("MongoDB connected"))
  .catch(err=>console.error(err));

/* ================= MODELS ================= */
const User = mongoose.model("User", new mongoose.Schema({
  name:String,
  email:{ type:String, unique:true },
  password:String,
  verified:{ type:Boolean, default:false },
  otp:String,
  otpExpires:Date
}));

const Product = mongoose.model("Product", new mongoose.Schema({
  title:String,
  description:String,
  images:[String],
  category:String,
  plans:[{
    name:String,
    price:Number,
    keys:[String]
  }]
}));

const Coupon = mongoose.model("Coupon", new mongoose.Schema({
  code:String,
  type:String, // percent | amount
  value:Number,
  expiresAt:Date,
  active:{ type:Boolean, default:true }
}));

const Order = mongoose.model("Order", new mongoose.Schema({
  user:mongoose.Schema.Types.ObjectId,
  product:{ type:mongoose.Schema.Types.ObjectId, ref:"Product" },
  planName:String,
  price:Number,
  finalPrice:Number,
  coupon:Object,
  proofImage:String,
  proofHash:String,
  ocrData:Object,
  status:{ type:String, default:"pending" },
  deliveredKey:String,
  createdAt:{ type:Date, default:Date.now }
}));

/* ================= UTILS ================= */
const USD_TO_SAR = 3.75;

function hashFile(filePath){
  const b = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(b).digest("hex");
}

function parseAmount(text){
  const match = text.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function detectCurrency(text){
  if(/ريال|sar/i.test(text)) return "SAR";
  return "USD";
}

/* ================= EMAIL (BREVO) ================= */
async function sendEmail(to, subject, html){
  await fetch("https://api.brevo.com/v3/smtp/email",{
    method:"POST",
    headers:{
      "api-key":process.env.BREVO_API_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      sender:{ name:"GLOM Store", email:process.env.SITE_EMAIL },
      to:[{ email:to }],
      subject,
      htmlContent:html
    })
  });
}

/* ================= UPLOAD ================= */
fs.mkdirSync("uploads/proofs",{ recursive:true });

const upload = multer({
  storage: multer.diskStorage({
    destination:"uploads/proofs",
    filename:(req,file,cb)=>{
      cb(null, Date.now()+"_"+file.originalname);
    }
  })
});

/* ================= AUTH ================= */
app.post("/api/auth/register", async(req,res)=>{
  const { name,email,password } = req.body;
  if(!name||!email||!password)
    return res.status(400).json({error:"MISSING_FIELDS"});

  const exists = await User.findOne({ email });
  if(exists) return res.status(400).json({error:"EMAIL_EXISTS"});

  const hash = await bcrypt.hash(password,10);
  const otp = Math.floor(100000+Math.random()*900000).toString();

  await User.create({
    name,
    email,
    password:hash,
    otp,
    otpExpires: Date.now()+10*60*1000
  });

  await sendEmail(
    email,
    "Verify your email",
    `<h2>GLOM Store</h2><p>Your code:</p><h1>${otp}</h1>`
  );

  res.json({ ok:true });
});

app.post("/api/auth/verify", async(req,res)=>{
  const { email,code } = req.body;
  const u = await User.findOne({ email });
  if(!u) return res.status(404).json({error:"NOT_FOUND"});

  if(u.otp!==code || Date.now()>u.otpExpires)
    return res.status(400).json({error:"INVALID_CODE"});

  u.verified=true;
  u.otp=null;
  await u.save();
  res.json({ ok:true });
});

app.post("/api/auth/login", async(req,res)=>{
  const { email,password } = req.body;
  const u = await User.findOne({ email });
  if(!u) return res.status(400).json({error:"INVALID_LOGIN"});

  const ok = await bcrypt.compare(password,u.password);
  if(!ok) return res.status(400).json({error:"INVALID_LOGIN"});
  if(!u.verified) return res.status(403).json({error:"NOT_VERIFIED"});

  res.json({ id:u._id, name:u.name, email:u.email });
});

/* ================= STORE ================= */
app.get("/api/store/products", async(req,res)=>{
  res.json(await Product.find());
});

app.get("/api/store/product/:id", async(req,res)=>{
  res.json(await Product.findById(req.params.id));
});

/* ================= CHECKOUT ================= */
app.post("/api/checkout", async(req,res)=>{
  const { productId, planName, couponCode } = req.body;
  const p = await Product.findById(productId);
  if(!p) return res.status(404).json({error:"PRODUCT_NOT_FOUND"});

  const plan = p.plans.find(x=>x.name===planName);
  if(!plan) return res.status(400).json({error:"PLAN_NOT_FOUND"});

  let finalPrice = plan.price;
  let coupon = null;

  if(couponCode){
    const c = await Coupon.findOne({ code:couponCode, active:true });
    if(c && (!c.expiresAt || c.expiresAt>new Date())){
      coupon={ code:c.code, type:c.type, value:c.value };
      if(c.type==="percent") finalPrice -= finalPrice*(c.value/100);
      if(c.type==="amount") finalPrice -= c.value;
      if(finalPrice<0) finalPrice=0;
    }
  }

  const o = await Order.create({
    product:p._id,
    planName,
    price:plan.price,
    finalPrice,
    coupon
  });

  res.json({ orderId:o._id });
});

/* ================= PROOF + OCR + DISCORD ================= */
app.post("/api/orders/:id/proof", upload.single("proof"), async(req,res)=>{
  const o = await Order.findById(req.params.id).populate("product");
  if(!o) return res.status(404).json({error:"ORDER_NOT_FOUND"});

  const filePath = "uploads/proofs/"+req.file.filename;
  const hash = hashFile(filePath);

  const dup = await Order.findOne({ proofHash:hash });

  /* OCR */
  const ocr = await Tesseract.recognize(filePath,"eng+ara");
  const text = ocr.data.text;

  const amount = parseAmount(text);
  const currency = detectCurrency(text);
  let usdAmount = amount;
  if(currency==="SAR") usdAmount = amount / USD_TO_SAR;

  o.proofImage="/uploads/proofs/"+req.file.filename;
  o.proofHash=hash;
  o.ocrData={ text, amount, currency, usdAmount };
  o.status = dup ? "manual_review" : "pending_review";
  await o.save();

  /* Discord */
  if(process.env.DISCORD_WEBHOOK_URL){
    await fetch(process.env.DISCORD_WEBHOOK_URL,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        embeds:[{
          title:"🧾 Payment Proof",
          description:`Order: ${o._id}`,
          color: dup ? 0xf59e0b : 0x8b5cf6,
          fields:[
            { name:"Product", value:o.product.title },
            { name:"Plan", value:o.planName },
            { name:"Detected", value:`${amount||"?"} ${currency}` },
            { name:"USD", value:usdAmount?usdAmount.toFixed(2):"?" },
            { name:"Status", value:o.status }
          ],
          image:{ url:o.proofImage }
        }]
      })
    });
  }

  res.json({ ok:true, auto:!dup && usdAmount>=o.finalPrice });
});

/* ================= ADMIN ================= */
function adminAuth(req,res,next){
  if(req.headers.authorization!=="Bearer "+process.env.ADMIN_TOKEN)
    return res.status(401).json({error:"ADMIN_ONLY"});
  next();
}

app.post("/api/admin/orders/:id/approve",adminAuth,async(req,res)=>{
  const o = await Order.findById(req.params.id).populate("product");
  const plan = o.product.plans.find(p=>p.name===o.planName);
  if(!plan||!plan.keys.length)
    return res.status(400).json({error:"NO_KEYS"});

  const key = plan.keys.shift();
  o.deliveredKey=key;
  o.status="approved";
  await o.product.save();
  await o.save();

  res.json({ key });
});

/* ================= START ================= */
const PORT = process.env.PORT || 10000;
app.listen(PORT,()=>console.log("GLOM running on",PORT));
