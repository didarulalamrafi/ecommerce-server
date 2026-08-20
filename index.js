// ================================================================
// Maati E-commerce Backend — Express + MongoDB
// ================================================================
// প্রতিটা বড় পরিবর্তনের আগে "// UPDATED:" অথবা "// NEW:" কমেন্ট
// দেওয়া আছে, যাতে আপনি সহজে খুঁজে বের করে এডিট করতে পারেন।
//
// NEW (এই আপডেটে যোগ হয়েছে):
//  - ইউজার রেজিস্টার/লগইন/লগআউট (JWT দিয়ে, httpOnly কুকিতে টোকেন থাকবে)
//  - verifyToken ও verifyAdmin মিডলওয়্যার — লগইন ছাড়া ড্যাশবোর্ড/কার্ট/অর্ডার
//    এক্সেস করা যাবে না, আর প্রোডাক্ট Add/Edit/Delete শুধু admin করতে পারবে
//  - প্রোডাক্ট দেখা (GET) সবার জন্য ওপেন থাকছে, লগইন লাগবে না
//  - কার্ট (add/update/remove) ও অর্ডার — শুধু লগইন করা ইউজার করতে পারবে
// ================================================================

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser"); // NEW: কুকি পড়ার জন্য — npm install cookie-parser
const bcrypt = require("bcryptjs"); // NEW: পাসওয়ার্ড হ্যাশ করার জন্য — npm install bcryptjs
const jwt = require("jsonwebtoken"); // NEW: লগইন টোকেন বানানোর জন্য — npm install jsonwebtoken

require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// NEW: JWT সাইন করার জন্য সিক্রেট — অবশ্যই .env ফাইলে JWT_SECRET=যেকোনো_লম্বা_র‍্যান্ডম_স্ট্রিং দিন
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// NEW: ফ্রন্টএন্ডের URL — .env এ CLIENT_URL=http://localhost:3000 না দিলে এটাই ডিফল্ট হবে
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(express.json());
app.use(cookieParser()); // NEW: req.cookies পড়তে লাগবে

// UPDATED: আগে app.use(cors()) ছিল যা wildcard origin ব্যবহার করে —
// কিন্তু কুকি (credentials) পাঠাতে হলে wildcard origin চলবে না,
// তাই নির্দিষ্ট origin + credentials: true দেওয়া হলো
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB-তে সংযোগ সফল হয়েছে!");
    db = client.db("maati");
  } catch (err) {
    console.error("❌ MongoDB সংযোগে সমস্যা:", err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------
// NEW: AUTH HELPERS
// ----------------------------------------------------------------

// টোকেন বানিয়ে httpOnly কুকিতে বসিয়ে দেয় — ব্রাউজার নিজে থেকেই এই কুকি
// পরের প্রতিটা রিকোয়েস্টের সাথে পাঠাবে (frontend-এ credentials: "include" থাকতে হবে)
function sendTokenCookie(res, user) {
  const token = jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // প্রোডাকশনে (HTTPS) true হতে হবে
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // ৭ দিন
  });
}

// এই মিডলওয়্যার যেকোনো রুটের আগে বসালে সেই রুট শুধু লগইন করা ইউজার এক্সেস করতে পারবে
function verifyToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: "লগইন করা প্রয়োজন" });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, email, role }
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "সেশন মেয়াদোত্তীর্ণ, আবার লগইন করুন" });
  }
}

// verifyToken এর পরে বসাতে হয় — শুধু admin role এর ইউজার পাস করতে পারবে
function verifyAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ error: "এই কাজের জন্য admin অ্যাক্সেস লাগবে" });
  }
  next();
}

// ----------------------------------------------------------------
// ROUTES
// ----------------------------------------------------------------

app.get("/", (req, res) => {
  res.send("It's ok!");
});

// ================================================================
// NEW: AUTH ROUTES
// ================================================================

// রেজিস্টার — নতুন ইউজার তৈরি, ডিফল্ট role "user"
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "নাম, ইমেইল ও পাসওয়ার্ড দিতে হবে" });
    }

    const existing = await db.collection("users").findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ error: "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // TODO: প্রথম admin বানাতে চাইলে — MongoDB Atlas-এ গিয়ে ম্যানুয়ালি
    // সেই ইউজারের role: "user" থেকে role: "admin" করে দিন
    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: "user",
      number: "",
      address: "",
      bio: "",
      createdAt: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);
    newUser._id = result.insertedId;

    sendTokenCookie(res, newUser);

    res.status(201).json({
      message: "রেজিস্ট্রেশন সফল হয়েছে",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "রেজিস্ট্রেশন করা যায়নি", details: err.message });
  }
});

// লগইন
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "ইমেইল ও পাসওয়ার্ড দিতে হবে" });
    }

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
    }

    sendTokenCookie(res, user);

    res.json({
      message: "লগইন সফল হয়েছে",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "লগইন করা যায়নি", details: err.message });
  }
});

// লগআউট — কুকি মুছে দেয়
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "লগআউট সফল হয়েছে" });
});

// লগইন করা ইউজারের তথ্য — Navbar/Dashboard এ কে লগইন আছে কিনা চেক করতে এটা কল হবে
app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const user = await db
      .collection("users")
      .findOne(
        { _id: new ObjectId(req.user.id) },
        { projection: { password: 0 } },
      );

    if (!user) {
      return res.status(404).json({ error: "ইউজার পাওয়া যায়নি" });
    }
    res.json(user);
  } catch (err) {
    res
      .status(500)
      .json({ error: "তথ্য লোড করা যায়নি", details: err.message });
  }
});

// ================================================================
// NEW: ইউজার প্রোফাইল রুট (নাম, নাম্বার, ঠিকানা, বায়ো এডিট)
// ================================================================

app.patch("/api/users/me", verifyToken, async (req, res) => {
  try {
    // ইমেইল/পাসওয়ার্ড/role এখান থেকে বদলানো যাবে না — শুধু প্রোফাইল ইনফো
    const { name, number, address, bio } = req.body;

    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(req.user.id) },
        { $set: { name, number, address, bio } },
      );

    res.json({ message: "প্রোফাইল আপডেট হয়েছে" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "প্রোফাইল আপডেট করা যায়নি", details: err.message });
  }
});

// ================================================================
// PRODUCT ROUTES
// ================================================================

// প্রোডাক্ট লিস্ট — সবার জন্য ওপেন, লগইন লাগবে না
app.get("/api/products", async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category) query.category = category;
    if (search) {
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

// একটা প্রোডাক্টের ডিটেইলস — এটাও সবার জন্য ওপেন (প্রোডাক্ট ডিটেইলস পেজের জন্য)
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

// UPDATED: এখন শুধু admin প্রোডাক্ট যোগ করতে পারবে (verifyToken + verifyAdmin)
app.post("/api/products", verifyToken, verifyAdmin, async (req, res) => {
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

// UPDATED: শুধু admin প্রোডাক্ট এডিট করতে পারবে
app.put("/api/products/:id", verifyToken, verifyAdmin, async (req, res) => {
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

// UPDATED: শুধু admin প্রোডাক্ট ডিলিট করতে পারবে
app.delete("/api/products/:id", verifyToken, verifyAdmin, async (req, res) => {
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

// ================================================================
// NEW: CART ROUTES — সব লগইন-প্রোটেক্টেড (verifyToken)
// প্রতিটা ইউজারের কার্ট একটাই ডকুমেন্ট, userId দিয়ে খোঁজা হয়
// ================================================================

// কার্ট দেখা
app.get("/api/cart", verifyToken, async (req, res) => {
  try {
    const cart = await db.collection("carts").findOne({ userId: req.user.id });
    res.json(cart?.items || []);
  } catch (err) {
    res
      .status(500)
      .json({ error: "কার্ট লোড করা যায়নি", details: err.message });
  }
});

// কার্টে প্রোডাক্ট যোগ করা — আগে থেকে থাকলে qty বাড়িয়ে দেয়
app.post("/api/cart", verifyToken, async (req, res) => {
  try {
    const { productId, name, price, image, qty } = req.body;

    const cart = await db.collection("carts").findOne({ userId: req.user.id });

    if (!cart) {
      await db.collection("carts").insertOne({
        userId: req.user.id,
        items: [{ productId, name, price, image, qty: qty || 1 }],
      });
    } else {
      const existingItem = cart.items.find((i) => i.productId === productId);

      if (existingItem) {
        await db
          .collection("carts")
          .updateOne(
            { userId: req.user.id, "items.productId": productId },
            { $inc: { "items.$.qty": qty || 1 } },
          );
      } else {
        await db
          .collection("carts")
          .updateOne(
            { userId: req.user.id },
            {
              $push: {
                items: { productId, name, price, image, qty: qty || 1 },
              },
            },
          );
      }
    }

    res.status(201).json({ message: "কার্টে যোগ হয়েছে" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "কার্টে যোগ করা যায়নি", details: err.message });
  }
});

// কার্টের কোনো আইটেমের quantity বদলানো
app.put("/api/cart/:productId", verifyToken, async (req, res) => {
  try {
    const { qty } = req.body;
    await db
      .collection("carts")
      .updateOne(
        { userId: req.user.id, "items.productId": req.params.productId },
        { $set: { "items.$.qty": qty } },
      );
    res.json({ message: "কার্ট আপডেট হয়েছে" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "কার্ট আপডেট করা যায়নি", details: err.message });
  }
});

// কার্ট থেকে একটা আইটেম সরানো
app.delete("/api/cart/:productId", verifyToken, async (req, res) => {
  try {
    await db
      .collection("carts")
      .updateOne(
        { userId: req.user.id },
        { $pull: { items: { productId: req.params.productId } } },
      );
    res.json({ message: "কার্ট থেকে সরানো হয়েছে" });
  } catch (err) {
    res.status(500).json({ error: "সরানো যায়নি", details: err.message });
  }
});

// ================================================================
// NEW: ORDER ROUTES — লগইন-প্রোটেক্টেড
// ================================================================

// চেকআউট — কার্ট থেকে অর্ডার তৈরি হয়, তারপর কার্ট খালি হয়ে যায়
app.post("/api/orders", verifyToken, async (req, res) => {
  try {
    const cart = await db.collection("carts").findOne({ userId: req.user.id });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: "কার্ট খালি" });
    }

    const total = cart.items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0,
    );

    const order = {
      userId: req.user.id,
      items: cart.items,
      total,
      status: "পেন্ডিং",
      createdAt: new Date(),
    };

    const result = await db.collection("orders").insertOne(order);

    // অর্ডার হয়ে গেলে কার্ট খালি করে দেওয়া হচ্ছে
    await db
      .collection("carts")
      .updateOne({ userId: req.user.id }, { $set: { items: [] } });

    res
      .status(201)
      .json({ message: "অর্ডার সম্পন্ন হয়েছে", orderId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "অর্ডার করা যায়নি", details: err.message });
  }
});

// লগইন করা ইউজারের নিজের অর্ডার হিস্টরি
app.get("/api/orders/me", verifyToken, async (req, res) => {
  try {
    const orders = await db
      .collection("orders")
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(orders);
  } catch (err) {
    res
      .status(500)
      .json({ error: "অর্ডার হিস্টরি লোড করা যায়নি", details: err.message });
  }
});

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

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Server চলছে: http://localhost:${port}`);
  });
});
