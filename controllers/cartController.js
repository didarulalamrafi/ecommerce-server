export async function getCart(req, res) {
  const cart = await req.db
    .collection("carts")
    .findOne({ userId: req.user.id });
  res.json(cart?.items || []);
}

export async function addToCart(req, res) {
  const { productId, name, price, image, qty } = req.body;
  if (!productId) {
    return res.status(400).json({ error: "productId দিতে হবে" });
  }

  // atomic upsert — race condition এড়াতে (আগেরটার মতোই)
  const updateExisting = await req.db
    .collection("carts")
    .updateOne(
      { userId: req.user.id, "items.productId": productId },
      { $inc: { "items.$.qty": qty || 1 } },
    );

  if (updateExisting.matchedCount === 0) {
    await req.db
      .collection("carts")
      .updateOne(
        { userId: req.user.id },
        { $push: { items: { productId, name, price, image, qty: qty || 1 } } },
        { upsert: true },
      );
  }

  res.status(201).json({ message: "কার্টে যোগ হয়েছে" });
}

export async function updateItem(req, res) {
  const { qty } = req.body;
  if (!qty || qty < 1) {
    return res.status(400).json({ error: "সঠিক quantity দিতে হবে" });
  }
  await req.db
    .collection("carts")
    .updateOne(
      { userId: req.user.id, "items.productId": req.params.productId },
      { $set: { "items.$.qty": qty } },
    );
  res.json({ message: "কার্ট আপডেট হয়েছে" });
}

export async function removeItem(req, res) {
  await req.db
    .collection("carts")
    .updateOne(
      { userId: req.user.id },
      { $pull: { items: { productId: req.params.productId } } },
    );
  res.json({ message: "কার্ট থেকে সরানো হয়েছে" });
}
