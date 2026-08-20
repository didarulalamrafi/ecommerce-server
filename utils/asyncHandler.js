// প্রতিটা async রুট handler কে wrap করে দেয়, যাতে try/catch বারবার লেখা
// না লাগে আর কোনো error unhandled থেকে সার্ভার crash না করে — সব error
// centralized errorHandler middleware এ গিয়ে ধরা পড়বে।
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
