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

  // ✅ ডেলিভারি চার্জসহ সাবটোটাল ও গ্র্যান্ড টোটাল হিসাব
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );
  const total = subtotal + DELIVERY_CHARGE;

  const order = {
    userId: req.user.id,
    items: cart.items,
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
    // ✅ সব অর্ডার শুরুতে "pending" — seller approve করলে "approved" হবে
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

// ---- Seller/Admin ----

// seller/admin এর জন্য সব pending অর্ডার দেখার লিস্ট
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

// ✅ seller/admin অর্ডার approve করবে — status "pending" থেকে "approved"
export async function approveOrder(req, res) {
  if (req.user.role !== "admin" && req.user.role !== "seller") {
    return res.status(403).json({ error: "অনুমতি নেই" });
  }

  const { ObjectId } = await import("mongodb");
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

// ✅ চাইলে reject-ও করা যাবে
export async function rejectOrder(req, res) {
  if (req.user.role !== "admin" && req.user.role !== "seller") {
    return res.status(403).json({ error: "অনুমতি নেই" });
  }

  const { ObjectId } = await import("mongodb");
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
