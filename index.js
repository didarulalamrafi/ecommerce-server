// ================================================================
// Maati E-commerce Backend — Express + MongoDB
// ================================================================
// প্রতিটা বড় পরিবর্তনের আগে "// UPDATED:" অথবা "// NEW:" কমেন্ট
// দেওয়া আছে, যাতে আপনি সহজে খুঁজে বের করে এডিট করতে পারেন।
// ================================================================

const express = require("express");
const cors = require("cors");

// NEW: dotenv দিয়ে .env ফাইল থেকে DB username/password লোড করা হচ্ছে,
// আগে uri-তে সরাসরি hardcode করা ছিল — সেটা কখনো GitHub-এ commit করবেন না।
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// NEW: JSON body parse করার জন্য (POST/PUT request-এ req.body পড়তে লাগবে)
app.use(express.json());
app.use(cors());

// UPDATED: পুরো connection URL-ই এখন .env থেকে আসছে, hardcoded নয়
// .env ফাইলে এভাবে রাখুন (শুধু এই দুইটা লাইনই যথেষ্ট):
//   MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.rzdpz1j.mongodb.net/maati?appName=Cluster0
//   PORT=3000
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// UPDATED: DB connection-টা এখন একটা module-level variable-এ রাখা হচ্ছে,
// যাতে প্রতিটা route-এ বারবার নতুন করে connect করতে না হয়।
let db;

async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB-তে সংযোগ সফল হয়েছে!");

    // UPDATED: আগে client.close() করে দেওয়া হতো ping-এর পরপরই —
    // এতে সার্ভারের বাকি রুটগুলো কাজ করতো না, কারণ কানেকশন বন্ধ হয়ে যেত।
    // তাই close() বাদ দিয়ে db reference-টা রেখে দিচ্ছি ব্যবহার করার জন্য।
    // db("maati") — এখানে আপনার MongoDB Atlas-এ থাকা ডাটাবেজের নাম বসান,
    // অথবা MONGODB_URI-এর ভেতরেই ("...net/maati?...") নাম দিয়ে রাখতে পারেন,
    // তাহলে client.db() খালি রাখলেও ওই ডাটাবেজটাই ব্যবহার হবে।
    db = client.db("maati");
  } catch (err) {
    console.error("❌ MongoDB সংযোগে সমস্যা:", err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------

app.get("/", (req, res) => {
  res.send("It's ok!");
});

// NEW: সব প্রোডাক্ট লিস্ট — category বা search দিয়ে ফিল্টার করা যায়
// উদাহরণ: /api/products?category=ভাসেস+%26+ডেকর&search=টেরাকোটা
app.get("/api/products", async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (search) {
      // name বা nameEn-এর মধ্যে case-insensitive খোঁজা
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { nameEn: { $regex: search, $options: "i" } },
      ];
    }

    const products = await db.collection("products").find(query).toArray();
    res.json(products);
  } catch (err) {
    res
      .status(500)
      .json({ error: "প্রোডাক্ট লোড করা যায়নি", details: err.message });
  }
});

// NEW: একটা নির্দিষ্ট প্রোডাক্ট (id দিয়ে) — product detail page-এর জন্য লাগবে
app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Product id সঠিক নয়" });
    }
    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
    }
    res.json(product);
  } catch (err) {
    res
      .status(500)
      .json({ error: "প্রোডাক্ট লোড করা যায়নি", details: err.message });
  }
});

// NEW: নতুন প্রোডাক্ট যোগ করা (admin panel বানালে সেখান থেকে কল হবে)
// body উদাহরণ:
// {
//   "name": "রাজশাহী টেরাকোটা ফুলদানি",
//   "nameEn": "Rajshahi Terracotta Vase",
//   "artisan": "মোঃ করিম, রাজশাহী",
//   "price": 1250,
//   "image": "https://...",
//   "category": "ফুলদানি ও ডেকর",
//   "tag": "নতুন",
//   "stock": 12
// }
app.post("/api/products", async (req, res) => {
  try {
    const product = {
      ...req.body,
      createdAt: new Date(),
    };
    const result = await db.collection("products").insertOne(product);
    res.status(201).json({ insertedId: result.insertedId, ...product });
  } catch (err) {
    res
      .status(500)
      .json({ error: "প্রোডাক্ট যোগ করা যায়নি", details: err.message });
  }
});

// NEW: প্রোডাক্ট আপডেট করা (দাম, স্টক, ট্যাগ ইত্যাদি বদলানোর জন্য)
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Product id সঠিক নয়" });
    }
    const result = await db
      .collection("products")
      .updateOne({ _id: new ObjectId(id) }, { $set: req.body });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
    }
    res.json({ message: "প্রোডাক্ট আপডেট হয়েছে" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "প্রোডাক্ট আপডেট করা যায়নি", details: err.message });
  }
});

// NEW: প্রোডাক্ট ডিলিট করা
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Product id সঠিক নয়" });
    }
    const result = await db
      .collection("products")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
    }
    res.json({ message: "প্রোডাক্ট ডিলিট হয়েছে" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "প্রোডাক্ট ডিলিট করা যায়নি", details: err.message });
  }
});

// NEW: হোমপেজের ক্যাটাগরি গ্রিডের জন্য — সব ইউনিক ক্যাটাগরি রিটার্ন করে
app.get("/api/categories", async (req, res) => {
  try {
    const categories = await db.collection("products").distinct("category");
    res.json(categories);
  } catch (err) {
    res
      .status(500)
      .json({ error: "ক্যাটাগরি লোড করা যায়নি", details: err.message });
  }
});

// NEW: ফুটার/হোমপেজের নিউজলেটার ফর্মের জন্য — ইমেইল সেভ করে, ডুপ্লিকেট আটকায়
app.post("/api/newsletter", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "ইমেইল দেওয়া হয়নি" });
    }

    const existing = await db.collection("newsletter").findOne({ email });
    if (existing) {
      return res.status(200).json({ message: "আপনি আগে থেকেই যুক্ত আছেন" });
    }

    await db
      .collection("newsletter")
      .insertOne({ email, subscribedAt: new Date() });
    res.status(201).json({ message: "সফলভাবে যুক্ত হয়েছেন" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "সাবস্ক্রাইব করা যায়নি", details: err.message });
  }
});

// ----------------------------------------------------------------
// SERVER START
// ----------------------------------------------------------------

// UPDATED: এখন প্রথমে DB connect হচ্ছে, তারপর server শুরু হচ্ছে —
// এতে নিশ্চিত হওয়া যায় যে কোনো request আসার আগেই DB রেডি আছে।
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Server চলছে: http://localhost:${port}`);
  });
});
