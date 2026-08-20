async function subscribe(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "ইমেইল দেওয়া হয়নি" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  // unique index এর উপর ভরসা করে সরাসরি insert — duplicate হলে catch করে
  // ধরা হচ্ছে, এতে race condition এর ঝুঁকি থাকে না
  try {
    await req.db
      .collection("newsletter")
      .insertOne({ email: normalizedEmail, subscribedAt: new Date() });
    res.status(201).json({ message: "সফলভাবে যুক্ত হয়েছেন" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ message: "আপনি আগে থেকেই যুক্ত আছেন" });
    }
    throw err;
  }
}

module.exports = { subscribe };
