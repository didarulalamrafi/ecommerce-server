export async function checkout(req, res) {
  const cart = await req.db
    .collection("carts")
    .findOne({ userId: req.user.id });

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

  const result = await req.db.collection("orders").insertOne(order);

  await req.db
    .collection("carts")
    .updateOne({ userId: req.user.id }, { $set: { items: [] } });

  res
    .status(201)
    .json({ message: "অর্ডার সম্পন্ন হয়েছে", orderId: result.insertedId });
}

export async function myOrders(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const orders = await req.db
    .collection("orders")
    .find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  res.json(orders);
}
