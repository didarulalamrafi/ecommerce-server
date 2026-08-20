const IS_PROD = process.env.NODE_ENV === "production";

function notFound(req, res) {
  res.status(404).json({ error: "রুট পাওয়া যায়নি" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: "সার্ভারে সমস্যা হয়েছে",
    details: IS_PROD ? undefined : err.message,
  });
}

module.exports = { notFound, errorHandler };
