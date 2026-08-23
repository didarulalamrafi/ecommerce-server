import { ObjectId } from "mongodb";

export async function list(req, res) {
  const { category, search } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  // পাবলিক লিস্টে শুধু approved প্রোডাক্ট দেখাবে।
  // status ফিল্ড ছাড়া পুরনো প্রোডাক্টও (মাইগ্রেশনের আগে যোগ করা) দেখাবে,
  // যাতে migrate করার আগে সব হঠাৎ অদৃশ্য হয়ে না যায়।
  const query = {
    $or: [{ status: "approved" }, { status: { $exists: false } }],
  };
  if (category) query.category = category;
  if (search) query.$text = { $search: search };

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    req.db.collection("products").find(query).skip(skip).limit(limit).toArray(),
    req.db.collection("products").countDocuments(query),
  ]);

  res.json({
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ✅ একটাই getOne — ObjectId অথবা slug দুটো দিয়েই প্রোডাক্ট খোঁজা যাবে
export async function getOne(req, res) {
  const { id } = req.params;

  const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { slug: id };

  const product = await req.db.collection("products").findOne(query);

  if (!product) {
    return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
  }
  res.json(product);
}

export async function create(req, res) {
  // admin নিজে বানালে সরাসরি approved, seller বানালে review-এ যাবে (pending)
  const status = req.user.role === "admin" ? "approved" : "pending";

  const product = {
    ...req.body,
    sellerId: req.user.id,
    status,
    adminNote: null,
    createdAt: new Date(),
  };
  const result = await req.db.collection("products").insertOne(product);
  res.status(201).json({ insertedId: result.insertedId, ...product });
}

// seller/admin নিজের dashboard এ নিজের বানানো প্রোডাক্ট দেখবে — সব status সহ
// (pending/approved/rejected), যাতে seller নিজের রিজেক্টেড প্রোডাক্ট আর
// admin এর নোটও দেখতে পারে
export async function mine(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const skip = (page - 1) * limit;

  const query = { sellerId: req.user.id };
  if (req.query.status) query.status = req.query.status;

  const [products, total] = await Promise.all([
    req.db.collection("products").find(query).skip(skip).limit(limit).toArray(),
    req.db.collection("products").countDocuments(query),
  ]);

  res.json({
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function update(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }

  // seller নিজের প্রোডাক্ট এডিট করলে সেটা আবার review-এ যাবে —
  // নাহলে seller approved প্রোডাক্ট চুপচাপ বদলে ফেলতে পারবে রিভিউ ছাড়াই
  const body = { ...req.body };
  if (req.user.role !== "admin") {
    body.status = "pending";
    body.adminNote = null;
  }

  const result = await req.db
    .collection("products")
    .updateOne({ _id: new ObjectId(id) }, { $set: body });

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
  }
  res.json({ message: "প্রোডাক্ট আপডেট হয়েছে" });
}

export async function remove(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }
  const result = await req.db
    .collection("products")
    .deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
  }
  res.json({ message: "প্রোডাক্ট ডিলিট হয়েছে" });
}

export async function categories(req, res) {
  const cats = await req.db.collection("products").distinct("category");
  res.json(cats);
}

// ---- Admin review ----

// admin এর pending queue — নতুন seller-submitted প্রোডাক্ট রিভিউ করার জন্য
export async function pendingList(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const skip = (page - 1) * limit;

  const query = { status: "pending" };

  const [products, total] = await Promise.all([
    req.db.collection("products").find(query).skip(skip).limit(limit).toArray(),
    req.db.collection("products").countDocuments(query),
  ]);

  res.json({
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function approve(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }

  const result = await req.db.collection("products").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "approved",
        adminNote: req.body?.note || null,
        reviewedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
  }
  res.json({ message: "প্রোডাক্ট অ্যাপ্রুভ হয়েছে" });
}

export async function reject(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }

  const result = await req.db.collection("products").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "rejected",
        adminNote: req.body?.note || null,
        reviewedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
  }
  res.json({ message: "প্রোডাক্ট রিজেক্ট হয়েছে" });
}
