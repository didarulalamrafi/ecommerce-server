const bcrypt = require("bcryptjs");
const { ObjectId } = require("mongodb");
const { sendTokenCookie, clearTokenCookie } = require("../utils/token");

async function register(req, res) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "নাম, ইমেইল ও পাসওয়ার্ড দিতে হবে" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await req.db
    .collection("users")
    .findOne({ email: normalizedEmail });
  if (existing) {
    return res
      .status(409)
      .json({ error: "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    name,
    email: normalizedEmail,
    password: hashedPassword,
    role: "user",
    number: "",
    address: "",
    bio: "",
    createdAt: new Date(),
  };

  const result = await req.db.collection("users").insertOne(newUser);
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
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "ইমেইল ও পাসওয়ার্ড দিতে হবে" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await req.db
    .collection("users")
    .findOne({ email: normalizedEmail });
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
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
}

function logout(req, res) {
  clearTokenCookie(res);
  res.json({ message: "লগআউট সফল হয়েছে" });
}

async function me(req, res) {
  const user = await req.db
    .collection("users")
    .findOne(
      { _id: new ObjectId(req.user.id) },
      { projection: { password: 0 } },
    );

  if (!user) {
    return res.status(404).json({ error: "ইউজার পাওয়া যায়নি" });
  }
  res.json(user);
}

module.exports = { register, login, logout, me };
