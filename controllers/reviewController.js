import { ObjectId } from "mongodb";

/**
 * GET /api/reviews/:productId
 * নির্দিষ্ট প্রোডাক্টের সব রিভিউ আনবে (নতুন আগে)
 */
export async function list(req, res) {
  const { productId } = req.params;
  if (!ObjectId.isValid(productId)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }

  const reviews = await req.db
    .collection("reviews")
    .find({ productId: new ObjectId(productId) })
    .sort({ createdAt: -1 })
    .toArray();

  res.json(reviews);
}

/**
 * POST /api/reviews
 * নতুন রিভিউ তৈরি করবে
 * body: { productId, name, rating, comment }
 */
export async function create(req, res) {
  const { productId, name, rating, comment } = req.body;

  if (!productId || !ObjectId.isValid(productId)) {
    return res.status(400).json({ error: "Product id সঠিক নয়" });
  }
  if (!name || !rating || !comment) {
    return res.status(400).json({ error: "সব ফিল্ড পূরণ করা আবশ্যক" });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: "রেটিং ১ থেকে ৫ এর মধ্যে হতে হবে" });
  }

  const review = {
    productId: new ObjectId(productId),
    name: String(name).trim().slice(0, 60),
    rating: Number(rating),
    comment: String(comment).trim().slice(0, 1000),
    // লগইন করা থাকলে userId রাখা, না থাকলে null (guest review)
    userId: req.user?.id || null,
    createdAt: new Date(),
  };

  const result = await req.db.collection("reviews").insertOne(review);

  // ✅ প্রোডাক্টের average rating আর review count আপডেট করা
  const allReviews = await req.db
    .collection("reviews")
    .find({ productId: new ObjectId(productId) })
    .toArray();

  const avgRating =
    allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

  await req.db.collection("products").updateOne(
    { _id: new ObjectId(productId) },
    {
      $set: {
        rating: Math.round(avgRating * 10) / 10,
        reviews: allReviews.length,
      },
    },
  );

  res.status(201).json({ insertedId: result.insertedId, ...review });
}

/**
 * DELETE /api/reviews/:id
 * (Optional) — auth middleware দিয়ে চাইলে শুধু owner/admin কে অনুমতি দিতে পারো
 */
export async function remove(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Review id সঠিক নয়" });
  }

  const review = await req.db
    .collection("reviews")
    .findOne({ _id: new ObjectId(id) });

  if (!review) {
    return res.status(404).json({ error: "রিভিউ পাওয়া যায়নি" });
  }

  await req.db.collection("reviews").deleteOne({ _id: new ObjectId(id) });

  // ডিলিটের পর আবার average rating রিক্যালকুলেট করা
  const remaining = await req.db
    .collection("reviews")
    .find({ productId: review.productId })
    .toArray();

  const avgRating =
    remaining.length > 0
      ? remaining.reduce((sum, r) => sum + r.rating, 0) / remaining.length
      : 0;

  await req.db.collection("products").updateOne(
    { _id: review.productId },
    {
      $set: {
        rating: Math.round(avgRating * 10) / 10,
        reviews: remaining.length,
      },
    },
  );

  res.json({ message: "রিভিউ ডিলিট হয়েছে" });
}
