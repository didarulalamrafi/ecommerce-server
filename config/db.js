const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  // serverless এর প্রতিটা instance এর নিজস্ব pool থাকে, তাই খুব বড় না
  // রেখে explicit রাখা হচ্ছে
  maxPoolSize: 10,
  minPoolSize: 0,
});

let dbConnectionPromise = null;

// Vercel এর প্রতিটা function invocation নতুন execution context এ চলতে
// পারে। প্রতিবার নতুন connect() না করে, promise cache করে রাখা হচ্ছে,
// যাতে একই সময়ে অনেক request একসাথে এলেও একবারই connect হয়।
async function getDB() {
  if (!dbConnectionPromise) {
    dbConnectionPromise = client
      .connect()
      .then(async () => {
        console.log("✅ MongoDB-তে সংযোগ সফল হয়েছে!");
        const database = client.db("maati");
        await ensureIndexes(database);
        return database;
      })
      .catch((err) => {
        dbConnectionPromise = null; // ব্যর্থ হলে পরের রিকোয়েস্টে আবার চেষ্টা করবে
        console.error("❌ MongoDB সংযোগে সমস্যা:", err);
        throw err;
      });
  }
  return dbConnectionPromise;
}

// প্রয়োজনীয় index — নতুন কোনো index লাগলে এখানে যোগ করবে
async function ensureIndexes(database) {
  try {
    await database
      .collection("users")
      .createIndex({ email: 1 }, { unique: true });
    await database
      .collection("carts")
      .createIndex({ userId: 1 }, { unique: true });
    await database.collection("orders").createIndex({ userId: 1 });
    await database.collection("orders").createIndex({ createdAt: -1 });
    await database.collection("products").createIndex({ category: 1 });
    await database
      .collection("products")
      .createIndex({ name: "text", nameEn: "text" });
    await database
      .collection("newsletter")
      .createIndex({ email: 1 }, { unique: true });
    console.log("✅ Indexes প্রস্তুত");
  } catch (err) {
    console.error("⚠️ Index তৈরিতে সমস্যা:", err.message);
  }
}

module.exports = { getDB, client };
