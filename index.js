// // ================================================================
// // Maati E-commerce Backend — Express + MongoDB
// // ================================================================
// // প্রতিটা বড় পরিবর্তনের আগে "// UPDATED:" অথবা "// NEW:" কমেন্ট
// // দেওয়া আছে, যাতে আপনি সহজে খুঁজে বের করে এডিট করতে পারেন।
// //
// // NEW (এই scaling আপডেটে যোগ হয়েছে):
// //  - Vercel serverless-friendly MongoDB connection (cold-start এ বার বার
// //    নতুন কানেকশন খুলবে না, cache করে রাখবে)
// //  - app.listen() এর বদলে module.exports = app (Vercel এর জন্য must)
// //  - প্রয়োজনীয় সব collection-এ index (email unique, userId, text-search)
// //  - প্রোডাক্ট লিস্টে pagination + $text search (regex এর বদলে, index-friendly)
// //  - Auth রুটে rate limiting (brute-force আটকাতে)
// //  - helmet + compression (security headers + response size কমানো)
// //  - Cross-domain cookie fix (frontend আর backend আলাদা vercel domain হলে
// //    sameSite:"lax" কাজ করবে না — production এ "none" + secure:true দরকার)
// //  - Centralized error handler + asyncHandler wrapper (try/catch বারবার
// //    লেখা লাগবে না, আর কোনো crash unhandled থাকবে না)
// //  - .env ভ্যালিডেশন — জরুরি env var মিসিং থাকলে বুঝিয়ে বলবে, চুপচাপ
// //    fallback secret দিয়ে চলবে না
// // ================================================================

// const express = require("express");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const helmet = require("helmet"); // NEW: npm install helmet
// const compression = require("compression"); // NEW: npm install compression
// const rateLimit = require("express-rate-limit"); // NEW: npm install express-rate-limit

// require("dotenv").config();

// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// // ----------------------------------------------------------------
// // NEW: ENV VALIDATION — জরুরি env var না থাকলে সার্ভার শুরুর আগেই বলে দেয়
// // ----------------------------------------------------------------
// const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET"];
// const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
// if (missingEnv.length > 0) {
//   console.error(
//     `❌ প্রয়োজনীয় env variable মিসিং: ${missingEnv.join(", ")}। .env ফাইলে এগুলো সেট করুন (Vercel এ Project Settings > Environment Variables)।`,
//   );
//   if (process.env.NODE_ENV === "production") {
//     // production এ fallback secret দিয়ে চলতে দেওয়া নিরাপদ না
//     throw new Error("Missing required environment variables");
//   }
// }

// const app = express();
// const port = process.env.PORT || 5000;

// const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";
// const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
// const IS_PROD = process.env.NODE_ENV === "production";

// // NEW: Vercel/যেকোনো proxy এর পেছনে থাকলে এটা লাগবে, নাহলে "secure" কুকি
// // ঠিকমতো সেট হয় না
// app.set("trust proxy", 1);

// // NEW: security headers
// app.use(helmet());

// // NEW: response compress করে দেয়, বিশেষ করে বড় product list এ পার্থক্য বোঝা যায়
// app.use(compression());

// // UPDATED: বড় body পাঠিয়ে সার্ভার বসিয়ে দেওয়া (DoS) ঠেকাতে limit দেওয়া হলো
// app.use(express.json({ limit: "1mb" }));
// app.use(cookieParser());

// app.use(
//   cors({
//     origin: CLIENT_URL,
//     credentials: true,
//   }),
// );

// // NEW: auth রুটে rate limit — brute-force login/register আটকাবে
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // ১৫ মিনিট
//   max: 30, // প্রতি IP থেকে ১৫ মিনিটে সর্বোচ্চ ৩০ বার
//   standardHeaders: true,
//   legacyHeaders: false,
//   message: { error: "অনেকবার চেষ্টা করা হয়েছে, একটু পর আবার চেষ্টা করুন" },
// });

// // NEW: বাকি সব API তেও একটা general limiter (খুব loose, শুধু abuse ঠেকানোর জন্য)
// const apiLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   max: 200,
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use("/api", apiLimiter);

// // ----------------------------------------------------------------
// // UPDATED: SERVERLESS-FRIENDLY MongoDB CONNECTION
// // ----------------------------------------------------------------
// // Vercel এর প্রতিটা function invocation নতুন execution context এ চলতে
// // পারে। যদি প্রতিবার নতুন MongoClient বানানো হয়, অল্প traffic এই MongoDB
// // Atlas এর connection limit শেষ হয়ে যায়। তাই client টাকে module-level এ
// // cache করে রাখা হচ্ছে, আর একটা promise cache করে রাখা হচ্ছে যাতে একই
// // সময়ে একাধিক request এসে একসাথে একাধিক connect() কল না করে।
// const uri = process.env.MONGODB_URI;

// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
//   // NEW: connection pool size — serverless এ প্রতিটা instance এর নিজস্ব
//   // pool থাকে, তাই খুব বড় রাখার দরকার নেই, কিন্তু ডিফল্টের চেয়ে explicit
//   // রাখা ভালো যাতে হুট করে অনেক connection না খুলে যায়
//   maxPoolSize: 10,
//   minPoolSize: 0,
// });

// let dbConnectionPromise = null;

// async function getDB() {
//   if (!dbConnectionPromise) {
//     dbConnectionPromise = client
//       .connect()
//       .then(async () => {
//         console.log("✅ MongoDB-তে সংযোগ সফল হয়েছে!");
//         const database = client.db("maati");
//         await ensureIndexes(database);
//         return database;
//       })
//       .catch((err) => {
//         dbConnectionPromise = null; // ব্যর্থ হলে পরের রিকোয়েস্টে আবার চেষ্টা করবে
//         console.error("❌ MongoDB সংযোগে সমস্যা:", err);
//         throw err;
//       });
//   }
//   return dbConnectionPromise;
// }

// // NEW: প্রতিটা রুটে db লাগে, তাই middleware দিয়ে req.db তে বসিয়ে দেওয়া হচ্ছে
// app.use(async (req, res, next) => {
//   try {
//     req.db = await getDB();
//     next();
//   } catch (err) {
//     res.status(503).json({ error: "ডাটাবেজের সাথে সংযোগ করা যাচ্ছে না" });
//   }
// });

// // NEW: প্রয়োজনীয় index তৈরি করে দেয় (প্রথমবার connect হওয়ার সময় একবার চলে)
// // - users.email: unique, দ্রুত login lookup
// // - carts.userId, orders.userId: প্রতিটা ইউজারের নিজের ডাটা দ্রুত খুঁজে পেতে
// // - orders.createdAt: order history sort দ্রুত করতে
// // - products.category: category filter দ্রুত করতে
// // - products এ text index: regex এর বদলে $text search ব্যবহার করলে
// //   হাজার হাজার product হলেও search fast থাকবে (regex বড় ডাটাসেটে স্লো)
// async function ensureIndexes(database) {
//   try {
//     await database
//       .collection("users")
//       .createIndex({ email: 1 }, { unique: true });
//     await database
//       .collection("carts")
//       .createIndex({ userId: 1 }, { unique: true });
//     await database.collection("orders").createIndex({ userId: 1 });
//     await database.collection("orders").createIndex({ createdAt: -1 });
//     await database.collection("products").createIndex({ category: 1 });
//     await database
//       .collection("products")
//       .createIndex({ name: "text", nameEn: "text" });
//     await database
//       .collection("newsletter")
//       .createIndex({ email: 1 }, { unique: true });
//     console.log("✅ Indexes প্রস্তুত");
//   } catch (err) {
//     // ইনডেক্স তৈরিতে সমস্যা হলেও সার্ভার বন্ধ হবে না, শুধু লগ করবে
//     console.error("⚠️ Index তৈরিতে সমস্যা:", err.message);
//   }
// }

// // NEW: প্রতিটা async রুট handler কে wrap করে দেয়, যাতে try/catch বারবার
// // লেখা না লাগে আর কোনো error unhandled promise rejection হয়ে সার্ভার
// // crash না করায়
// function asyncHandler(fn) {
//   return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
// }

// // ----------------------------------------------------------------
// // AUTH HELPERS
// // ----------------------------------------------------------------

// function sendTokenCookie(res, user) {
//   const token = jwt.sign(
//     { id: user._id.toString(), email: user.email, role: user.role },
//     JWT_SECRET,
//     { expiresIn: "7d" },
//   );

//   res.cookie("token", token, {
//     httpOnly: true,
//     secure: IS_PROD, // production (HTTPS) এ true
//     // UPDATED: frontend (ecommerce) আর backend (ecommerce-server) যেহেতু
//     // আলাদা Vercel domain এ থাকে, sameSite:"lax" cross-site POST/PUT/DELETE
//     // এ কুকি পাঠাবে না। production এ "none" লাগবে (এর সাথে secure:true
//     // বাধ্যতামূলক, নাহলে ব্রাউজার কুকি reject করবে)
//     sameSite: IS_PROD ? "none" : "lax",
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//   });
// }

// function verifyToken(req, res, next) {
//   const token = req.cookies.token;
//   if (!token) {
//     return res.status(401).json({ error: "লগইন করা প্রয়োজন" });
//   }
//   try {
//     req.user = jwt.verify(token, JWT_SECRET);
//     next();
//   } catch (err) {
//     return res
//       .status(401)
//       .json({ error: "সেশন মেয়াদোত্তীর্ণ, আবার লগইন করুন" });
//   }
// }

// function verifyAdmin(req, res, next) {
//   if (req.user?.role !== "admin") {
//     return res
//       .status(403)
//       .json({ error: "এই কাজের জন্য admin অ্যাক্সেস লাগবে" });
//   }
//   next();
// }

// // ----------------------------------------------------------------
// // ROUTES
// // ----------------------------------------------------------------

// app.get("/", (req, res) => {
//   res.send("It's ok!");
// });

// // ================================================================
// // AUTH ROUTES
// // ================================================================

// app.post(
//   "/api/auth/register",
//   authLimiter,
//   asyncHandler(async (req, res) => {
//     const { name, email, password } = req.body;
//     if (!name || !email || !password) {
//       return res
//         .status(400)
//         .json({ error: "নাম, ইমেইল ও পাসওয়ার্ড দিতে হবে" });
//     }
//     // NEW: বেসিক ভ্যালিডেশন — খুব ছোট পাসওয়ার্ড আটকানো ভালো অভ্যাস
//     if (password.length < 6) {
//       return res
//         .status(400)
//         .json({ error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে" });
//     }

//     const normalizedEmail = email.trim().toLowerCase();

//     const existing = await req.db
//       .collection("users")
//       .findOne({ email: normalizedEmail });
//     if (existing) {
//       return res
//         .status(409)
//         .json({ error: "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = {
//       name,
//       email: normalizedEmail,
//       password: hashedPassword,
//       role: "user",
//       number: "",
//       address: "",
//       bio: "",
//       createdAt: new Date(),
//     };

//     const result = await req.db.collection("users").insertOne(newUser);
//     newUser._id = result.insertedId;

//     sendTokenCookie(res, newUser);

//     res.status(201).json({
//       message: "রেজিস্ট্রেশন সফল হয়েছে",
//       user: {
//         id: newUser._id,
//         name: newUser.name,
//         email: newUser.email,
//         role: newUser.role,
//       },
//     });
//   }),
// );

// app.post(
//   "/api/auth/login",
//   authLimiter,
//   asyncHandler(async (req, res) => {
//     const { email, password } = req.body;
//     if (!email || !password) {
//       return res.status(400).json({ error: "ইমেইল ও পাসওয়ার্ড দিতে হবে" });
//     }

//     const normalizedEmail = email.trim().toLowerCase();

//     const user = await req.db
//       .collection("users")
//       .findOne({ email: normalizedEmail });
//     if (!user) {
//       return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ error: "ইমেইল বা পাসওয়ার্ড ভুল" });
//     }

//     sendTokenCookie(res, user);

//     res.json({
//       message: "লগইন সফল হয়েছে",
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: user.role,
//       },
//     });
//   }),
// );

// app.post("/api/auth/logout", (req, res) => {
//   res.clearCookie("token", {
//     httpOnly: true,
//     secure: IS_PROD,
//     sameSite: IS_PROD ? "none" : "lax",
//   });
//   res.json({ message: "লগআউট সফল হয়েছে" });
// });

// app.get(
//   "/api/auth/me",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const user = await req.db
//       .collection("users")
//       .findOne(
//         { _id: new ObjectId(req.user.id) },
//         { projection: { password: 0 } },
//       );

//     if (!user) {
//       return res.status(404).json({ error: "ইউজার পাওয়া যায়নি" });
//     }
//     res.json(user);
//   }),
// );

// // ================================================================
// // ইউজার প্রোফাইল রুট
// // ================================================================

// app.patch(
//   "/api/users/me",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const { name, number, address, bio } = req.body;

//     await req.db
//       .collection("users")
//       .updateOne(
//         { _id: new ObjectId(req.user.id) },
//         { $set: { name, number, address, bio } },
//       );

//     res.json({ message: "প্রোফাইল আপডেট হয়েছে" });
//   }),
// );

// // ================================================================
// // PRODUCT ROUTES
// // ================================================================

// // UPDATED: pagination + $text search (regex এর বদলে) — প্রোডাক্ট হাজার
// // হাজার হয়ে গেলেও এই ভার্সন স্লো হবে না, কারণ MongoDB এখন index ব্যবহার
// // করতে পারবে। limit সর্বোচ্চ ৫০ এ capped, যাতে কেউ ?limit=100000 দিয়ে
// // পুরো ডাটাবেজ এক রিকোয়েস্টে টেনে সার্ভার ভারী করে ফেলতে না পারে।
// app.get(
//   "/api/products",
//   asyncHandler(async (req, res) => {
//     const { category, search } = req.query;
//     const page = Math.max(parseInt(req.query.page) || 1, 1);
//     const limit = Math.min(parseInt(req.query.limit) || 20, 50);
//     const skip = (page - 1) * limit;

//     const query = {};
//     if (category) query.category = category;
//     if (search) query.$text = { $search: search };

//     const [products, total] = await Promise.all([
//       req.db
//         .collection("products")
//         .find(query)
//         .skip(skip)
//         .limit(limit)
//         .toArray(),
//       req.db.collection("products").countDocuments(query),
//     ]);

//     res.json({
//       products,
//       pagination: {
//         page,
//         limit,
//         total,
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   }),
// );

// app.get(
//   "/api/products/:id",
//   asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     if (!ObjectId.isValid(id)) {
//       return res.status(400).json({ error: "Product id সঠিক নয়" });
//     }
//     const product = await req.db
//       .collection("products")
//       .findOne({ _id: new ObjectId(id) });

//     if (!product) {
//       return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
//     }
//     res.json(product);
//   }),
// );

// app.post(
//   "/api/products",
//   verifyToken,
//   verifyAdmin,
//   asyncHandler(async (req, res) => {
//     const product = {
//       ...req.body,
//       createdAt: new Date(),
//     };
//     const result = await req.db.collection("products").insertOne(product);
//     res.status(201).json({ insertedId: result.insertedId, ...product });
//   }),
// );

// app.put(
//   "/api/products/:id",
//   verifyToken,
//   verifyAdmin,
//   asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     if (!ObjectId.isValid(id)) {
//       return res.status(400).json({ error: "Product id সঠিক নয়" });
//     }
//     const result = await req.db
//       .collection("products")
//       .updateOne({ _id: new ObjectId(id) }, { $set: req.body });

//     if (result.matchedCount === 0) {
//       return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
//     }
//     res.json({ message: "প্রোডাক্ট আপডেট হয়েছে" });
//   }),
// );

// app.delete(
//   "/api/products/:id",
//   verifyToken,
//   verifyAdmin,
//   asyncHandler(async (req, res) => {
//     const { id } = req.params;
//     if (!ObjectId.isValid(id)) {
//       return res.status(400).json({ error: "Product id সঠিক নয়" });
//     }
//     const result = await req.db
//       .collection("products")
//       .deleteOne({ _id: new ObjectId(id) });

//     if (result.deletedCount === 0) {
//       return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
//     }
//     res.json({ message: "প্রোডাক্ট ডিলিট হয়েছে" });
//   }),
// );

// app.get(
//   "/api/categories",
//   asyncHandler(async (req, res) => {
//     const categories = await req.db.collection("products").distinct("category");
//     res.json(categories);
//   }),
// );

// // ================================================================
// // CART ROUTES
// // ================================================================

// app.get(
//   "/api/cart",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const cart = await req.db
//       .collection("carts")
//       .findOne({ userId: req.user.id });
//     res.json(cart?.items || []);
//   }),
// );

// app.post(
//   "/api/cart",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const { productId, name, price, image, qty } = req.body;
//     if (!productId) {
//       return res.status(400).json({ error: "productId দিতে হবে" });
//     }

//     // UPDATED: আগে findOne করে জাভাস্ক্রিপ্টে চেক করে তারপর updateOne করা
//     // হতো (দুইটা আলাদা DB round-trip, আর race condition এর ঝুঁকি ছিল —
//     // দুইটা রিকোয়েস্ট একসাথে এলে item duplicate হয়ে যেতে পারত)। এখন
//     // একটামাত্র atomic upsert দিয়ে কাজ চলছে।
//     const updateExisting = await req.db
//       .collection("carts")
//       .updateOne(
//         { userId: req.user.id, "items.productId": productId },
//         { $inc: { "items.$.qty": qty || 1 } },
//       );

//     if (updateExisting.matchedCount === 0) {
//       await req.db.collection("carts").updateOne(
//         { userId: req.user.id },
//         {
//           $push: {
//             items: { productId, name, price, image, qty: qty || 1 },
//           },
//         },
//         { upsert: true },
//       );
//     }

//     res.status(201).json({ message: "কার্টে যোগ হয়েছে" });
//   }),
// );

// app.put(
//   "/api/cart/:productId",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const { qty } = req.body;
//     if (!qty || qty < 1) {
//       return res.status(400).json({ error: "সঠিক quantity দিতে হবে" });
//     }
//     await req.db
//       .collection("carts")
//       .updateOne(
//         { userId: req.user.id, "items.productId": req.params.productId },
//         { $set: { "items.$.qty": qty } },
//       );
//     res.json({ message: "কার্ট আপডেট হয়েছে" });
//   }),
// );

// app.delete(
//   "/api/cart/:productId",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     await req.db
//       .collection("carts")
//       .updateOne(
//         { userId: req.user.id },
//         { $pull: { items: { productId: req.params.productId } } },
//       );
//     res.json({ message: "কার্ট থেকে সরানো হয়েছে" });
//   }),
// );

// // ================================================================
// // ORDER ROUTES
// // ================================================================

// app.post(
//   "/api/orders",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const cart = await req.db
//       .collection("carts")
//       .findOne({ userId: req.user.id });

//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({ error: "কার্ট খালি" });
//     }

//     const total = cart.items.reduce(
//       (sum, item) => sum + item.price * item.qty,
//       0,
//     );

//     const order = {
//       userId: req.user.id,
//       items: cart.items,
//       total,
//       status: "পেন্ডিং",
//       createdAt: new Date(),
//     };

//     const result = await req.db.collection("orders").insertOne(order);

//     await req.db
//       .collection("carts")
//       .updateOne({ userId: req.user.id }, { $set: { items: [] } });

//     res
//       .status(201)
//       .json({ message: "অর্ডার সম্পন্ন হয়েছে", orderId: result.insertedId });
//   }),
// );

// // UPDATED: order history তেও pagination — একজন পুরনো ইউজারের শত শত অর্ডার
// // থাকলে সব একসাথে না টেনে পাতা ধরে আনা হচ্ছে
// app.get(
//   "/api/orders/me",
//   verifyToken,
//   asyncHandler(async (req, res) => {
//     const page = Math.max(parseInt(req.query.page) || 1, 1);
//     const limit = Math.min(parseInt(req.query.limit) || 20, 50);

//     const orders = await req.db
//       .collection("orders")
//       .find({ userId: req.user.id })
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .toArray();
//     res.json(orders);
//   }),
// );

// app.post(
//   "/api/newsletter",
//   asyncHandler(async (req, res) => {
//     const { email } = req.body;
//     if (!email) {
//       return res.status(400).json({ error: "ইমেইল দেওয়া হয়নি" });
//     }
//     const normalizedEmail = email.trim().toLowerCase();

//     // UPDATED: আগের মতো findOne + insertOne (দুই ধাপ) না করে, unique index
//     // এর উপর ভরসা করে সরাসরি insert করা হচ্ছে — duplicate হলে catch করে
//     // ধরা হচ্ছে। এতে race condition এর ঝুঁকি থাকে না।
//     try {
//       await req.db
//         .collection("newsletter")
//         .insertOne({ email: normalizedEmail, subscribedAt: new Date() });
//       res.status(201).json({ message: "সফলভাবে যুক্ত হয়েছেন" });
//     } catch (err) {
//       if (err.code === 11000) {
//         return res.status(200).json({ message: "আপনি আগে থেকেই যুক্ত আছেন" });
//       }
//       throw err;
//     }
//   }),
// );

// // ----------------------------------------------------------------
// // NEW: 404 + CENTRALIZED ERROR HANDLER
// // ----------------------------------------------------------------
// // কোনো রুট না মিললে সুন্দর 404, আর asyncHandler থেকে আসা যেকোনো error
// // এখানে এসে ধরা পড়বে — পুরো সার্ভার crash করবে না, ইউজার একটা readable
// // error message পাবে।
// app.use((req, res) => {
//   res.status(404).json({ error: "রুট পাওয়া যায়নি" });
// });

// app.use((err, req, res, next) => {
//   console.error("❌ Unhandled error:", err);
//   res.status(500).json({
//     error: "সার্ভারে সমস্যা হয়েছে",
//     details: IS_PROD ? undefined : err.message,
//   });
// });

// // ----------------------------------------------------------------
// // UPDATED: SERVER START — Vercel serverless vs লোকাল ডেভেলপমেন্ট
// // ----------------------------------------------------------------
// // Vercel এ app.listen() কাজ করে না — Vercel নিজেই request handle করার
// // জন্য exported app কে function হিসেবে কল করে। তাই module.exports = app
// // থাকতে হবে। লোকালে ডেভেলপ করার সময় (VERCEL env var না থাকলে) সাধারণ
// // app.listen() দিয়েই চলবে।
// if (!process.env.VERCEL) {
//   getDB()
//     .then(() => {
//       app.listen(port, () => {
//         console.log(`🚀 Server চলছে: http://localhost:${port}`);
//       });
//     })
//     .catch(() => process.exit(1));
// }

// module.exports = app;

// ********************************************
// New Code, redesinged
// *********************************************

// ================================================================
// Maati E-commerce Backend — Express + MongoDB + better-auth
// ================================================================
// Auth রুট better-auth নিজে থেকেই এক্সপোজ করে:
//   POST /api/auth/sign-up/email   → register
//   POST /api/auth/sign-in/email   → login
//   POST /api/auth/sign-out        → logout
//   GET  /api/auth/get-session     → লগইন করা ইউজারের তথ্য
// ================================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { toNodeHandler } from "better-auth/node";
import "dotenv/config";

import { auth } from "./config/auth.js";
import { getDB } from "./config/db.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";

import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import miscRoutes from "./routes/miscRoutes.js";
import reviewRoutes from "./routes/reviews.js";

// ----------------------------------------------------------------
// ENV VALIDATION
// ----------------------------------------------------------------
const REQUIRED_ENV = ["MONGODB_URI", "BETTER_AUTH_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `❌ প্রয়োজনীয় env variable মিসিং: ${missingEnv.join(", ")}। .env এ সেট করুন (BETTER_AUTH_SECRET বানাতে: openssl rand -base64 32)।`,
  );
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variables");
  }
}

const app = express();
const port = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: CLIENT_URL, credentials: true }));

// ⚠️ জরুরি: better-auth এর handler express.json() এর *আগে* বসাতে হবে —
// better-auth নিজেই request body parse করে, express.json() আগে বসালে
// conflict/bug হবে
app.all("/api/auth/*splat", toNodeHandler(auth));

// এর পরে বাকি রুটের জন্য normal JSON parsing
app.use(express.json({ limit: "1mb" }));

// req.db তে ডাটাবেজ বসিয়ে দেয় (product/cart/order/user রুটের জন্য)
app.use(async (req, res, next) => {
  try {
    req.db = await getDB();
    next();
  } catch (err) {
    res.status(503).json({ error: "ডাটাবেজের সাথে সংযোগ করা যাচ্ছে না" });
  }
});

app.use("/api", apiLimiter);

app.get("/", (req, res) => res.send("It's ok!"));

// ⚠️ সব নির্দিষ্ট রুট এখানে বসবে, notFound/errorHandler-এর *আগে* —
// নাহলে notFound সব রিকোয়েস্ট এই পর্যন্ত পৌঁছানোর আগেই ধরে ফেলবে
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/user", userRoutes);
app.use("/api", miscRoutes); // /api/categories, /api/newsletter
app.use("/api/reviews", reviewRoutes);

// ⚠️ এই দুটো সবসময় সবার শেষে থাকবে
app.use(notFound);
app.use(errorHandler);

if (!process.env.VERCEL) {
  getDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`🚀 Server চলছে: http://localhost:${port}`);
      });
    })
    .catch(() => process.exit(1));
}

export default app;
