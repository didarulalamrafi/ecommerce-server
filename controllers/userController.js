const { ObjectId } = require("mongodb");

async function updateMe(req, res) {
  const { name, number, address, bio } = req.body;

  await req.db
    .collection("users")
    .updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { name, number, address, bio } },
    );

  res.json({ message: "প্রোফাইল আপডেট হয়েছে" });
}

module.exports = { updateMe };
