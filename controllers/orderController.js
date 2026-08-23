import { ObjectId } from "mongodb";

const DELIVERY_CHARGE = 120;

export async function checkout(req, res) {
  const cart = await req.db
    .collection("carts")
    .findOne({ userId: req.user.id });

  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ error: "কার্ট খালি" });
  }

  const { deliveryAddress, paymentMethod, payment } = req.body;

  if (
    !deliveryAddress ||
    !deliveryAddress.name ||
    !deliveryAddress.phone ||
    !deliveryAddress.district ||
    !deliveryAddress.upazila ||
    !deliveryAddress.area
  ) {
    return res.status(400).json({ error: "ডেলিভারি ঠিকানার সব তথ্য দিতে হবে" });
  }

  if (!["cod", "bkash"].includes(paymentMethod)) {
    return res.status(400).json({ error: "সঠিক পেমেন্ট মেথড বেছে নিন" });
  }

  let paymentInfo = { method: "cod" };

  if (paymentMethod === "bkash") {
    if (!payment?.senderNumber || !payment?.transactionId) {
      return res.status(400).json({
        error: "বিকাশ সেন্ডার নাম্বার এবং ট্রানজেকশন আইডি দিতে হবে",
      });
    }
    paymentInfo = {
      method: "bkash",
      senderNumber: payment.senderNumber,
      transactionId: payment.transactionId,
      verified: false,
    };
  }

  // ✅ মাল্টি-ভেন্ডরের জন্য প্রতিটা cart item এর জন্য প্রোডাক্ট থেকে sellerId বের করে বসানো হচ্ছে
  // (verifyProductOwnerOrAdmin এর মতোই — product.sellerId একটা প্লেইন স্ট্রিং, Better Auth এর user id)
  const productIds = cart.items.map((i) => new ObjectId(i.productId));
  const products = await req.db
    .collection("products")
    .find({ _id: { $in: productIds } })
    .toArray();

  const items = cart.items.map((cartItem) => {
    const product = products.find(
      (p) => p._id.toString() === cartItem.productId.toString(),
    );
    return {
      ...cartItem,
      sellerId: product?.sellerId || null,
      // প্রতিটা আইটেমের নিজস্ব স্ট্যাটাস — যে সেলারের প্রোডাক্ট, শুধু সেই বদলাতে পারবে
      status: "pending",
      note: "",
    };
  });

  // ✅ ডেলিভারি চার্জসহ সাবটোটাল ও গ্র্যান্ড টোটাল হিসাব
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal + DELIVERY_CHARGE;

  const order = {
    userId: req.user.id,
    items,
    subtotal,
    deliveryCharge: DELIVERY_CHARGE,
    total,
    deliveryAddress: {
      name: deliveryAddress.name,
      phone: deliveryAddress.phone,
      district: deliveryAddress.district,
      upazila: deliveryAddress.upazila,
      area: deliveryAddress.area,
      addressLine: deliveryAddress.addressLine || "",
    },
    payment: paymentInfo,
    // পুরো অর্ডারের overall status — সব আইটেমের status থেকে derive করা, শুরুতে সব "pending"
    status: "pending",
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

// ---- Admin (whole-order, legacy) ----

export async function pendingOrders(req, res) {
  if (req.user.role !== "admin" && req.user.role !== "seller") {
    return res.status(403).json({ error: "অনুমতি নেই" });
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const orders = await req.db
    .collection("orders")
    .find({ status: "pending" })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  res.json(orders);
}

export async function approveOrder(req, res) {
  if (req.user.role !== "admin") {
    // ⚠️ আগে "seller" রোলও পারতো, কিন্তু ownership চেক ছিল না — এটা শুধু admin এর জন্য রাখলাম
    return res.status(403).json({ error: "অনুমতি নেই" });
  }

  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Order id সঠিক নয়" });
  }

  const result = await req.db.collection("orders").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.user.id,
      },
    },
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
  }
  res.json({ message: "অর্ডার অ্যাপ্রুভ হয়েছে" });
}

export async function rejectOrder(req, res) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "অনুমতি নেই" });
  }

  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Order id সঠিক নয়" });
  }

  const result = await req.db.collection("orders").updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: req.user.id,
      },
    },
  );

  if (result.matchedCount === 0) {
    return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
  }
  res.json({ message: "অর্ডার রিজেক্ট হয়েছে" });
}

// ---- Seller (item-level, নতুন) ----

// সব আইটেমের status মিলিয়ে overall order.status ঠিক করার হেল্পার
function recalcStatus(items) {
  const statuses = items.map((i) => i.status);
  if (statuses.every((s) => s === "delivered")) return "delivered";
  if (statuses.every((s) => s === "cancelled")) return "cancelled";
  if (statuses.some((s) => s === "pending")) return "pending";
  return "approved";
}

// সেলারের নিজের অর্ডার — শুধু নিজের sellerId মেলা আইটেম রেখে বাকিটা ফিল্টার করে দেয়
export async function mySellerOrders(req, res) {
  if (req.user.role !== "admin" && req.user.role !== "seller") {
    return res.status(403).json({ error: "অনুমতি নেই" });
  }

  const sellerId = req.user.id;

  const orders = await req.db
    .collection("orders")
    .find({ "items.sellerId": sellerId })
    .sort({ createdAt: -1 })
    .toArray();

  // Better Auth ডিফল্টে "user" কালেকশনে স্ট্রিং _id সেভ করে (Mongo ObjectId না)
  const buyerIds = [...new Set(orders.map((o) => o.userId))];
  const buyers = await req.db
    .collection("user")
    .find({ _id: { $in: buyerIds } })
    .toArray();

  const result = orders.map((order) => {
    const buyer = buyers.find((b) => b._id === order.userId);
    return {
      ...order,
      items: order.items.filter((i) => i.sellerId === sellerId),
      buyer: buyer
        ? {
            _id: buyer._id,
            name: buyer.name,
            email: buyer.email,
            phone: buyer.phone,
          }
        : null,
    };
  });

  res.json(result);
}

// একটা নির্দিষ্ট আইটেমে সেলারের ownership যাচাই করে অর্ডার+আইটেম রিটার্ন করে
// permission না থাকলে বা না পাওয়া গেলে নিজেই res পাঠিয়ে null রিটার্ন করে
async function findOwnedOrderItem(req, res) {
  const { id, productId } = req.params;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: "Order id সঠিক নয়" });
    return null;
  }

  const order = await req.db
    .collection("orders")
    .findOne({ _id: new ObjectId(id) });
  if (!order) {
    res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    return null;
  }

  const item = order.items.find((i) => i.productId.toString() === productId);
  if (!item) {
    res.status(404).json({ error: "অর্ডার আইটেম পাওয়া যায়নি" });
    return null;
  }

  const isOwner = item.sellerId === req.user.id;
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: "এই আইটেমে পরিবর্তন করার অনুমতি নেই" });
    return null;
  }

  return order;
}

export async function approveOrderItem(req, res) {
  const order = await findOwnedOrderItem(req, res);
  if (!order) return;

  const { productId } = req.params;
  const items = order.items.map((i) =>
    i.productId.toString() === productId ? { ...i, status: "approved" } : i,
  );

  await req.db
    .collection("orders")
    .updateOne(
      { _id: order._id },
      { $set: { items, status: recalcStatus(items) } },
    );

  res.json({ message: "আইটেম অ্যাপ্রুভ হয়েছে" });
}

// নোটসহ ডেলিভারড মার্ক — এই নোট myOrders() এর মাধ্যমে ক্রেতার ড্যাশবোর্ডে দেখা যাবে
export async function deliverOrderItem(req, res) {
  const order = await findOwnedOrderItem(req, res);
  if (!order) return;

  const { productId } = req.params;
  const { note } = req.body;

  const items = order.items.map((i) =>
    i.productId.toString() === productId
      ? { ...i, status: "delivered", note: note || "" }
      : i,
  );

  await req.db
    .collection("orders")
    .updateOne(
      { _id: order._id },
      { $set: { items, status: recalcStatus(items) } },
    );

  res.json({ message: "আইটেম ডেলিভারড হিসেবে মার্ক হয়েছে" });
}

// "ডিলিট" — item soft-cancel করে, পুরো order document মোছা হয় না
// (একই অর্ডারে অন্য সেলারের আইটেম থাকতে পারে)
export async function cancelOrderItem(req, res) {
  const order = await findOwnedOrderItem(req, res);
  if (!order) return;

  const { productId } = req.params;
  const items = order.items.map((i) =>
    i.productId.toString() === productId ? { ...i, status: "cancelled" } : i,
  );

  await req.db
    .collection("orders")
    .updateOne(
      { _id: order._id },
      { $set: { items, status: recalcStatus(items) } },
    );

  res.json({ message: "আইটেম বাতিল হয়েছে" });
}
