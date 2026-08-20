import { ObjectId } from "mongodb";

export async function list(req, res) {
  const { category, search } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const query = {};
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

export async function getOne(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }
  const product = await req.db
    .collection("products")
    .findOne({ _id: new ObjectId(id) });
  if (!product) {
    return res.status(404).json({ error: "প্রোডাক্ট পাওয়া যায়নি" });
  }
  res.json(product);
}

export async function create(req, res) {
  const product = { ...req.body, createdAt: new Date() };
  const result = await req.db.collection("products").insertOne(product);
  res.status(201).json({ insertedId: result.insertedId, ...product });
}

export async function update(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }
  const result = await req.db
    .collection("products")
    .updateOne({ _id: new ObjectId(id) }, { $set: req.body });

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
