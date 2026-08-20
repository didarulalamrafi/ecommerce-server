// config/db.js
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.MONGODB_URI;

export const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    // UPDATED: strict:true থাকলে text index তৈরি করা যায় না
    // ("text indexes cannot be created with apiStrict: true") — তাই বন্ধ
    strict: false,
    deprecationErrors: true,
  },
  maxPoolSize: 10,
  minPoolSize: 0,
});

let connectPromise = null;

// better-auth ও আমাদের নিজেদের collection (products/cart/orders) — দুইটাই
// একই connected client শেয়ার করবে, তাই connect() একবারই হবে
export function connectClient() {
  if (!connectPromise) {
    connectPromise = client
      .connect()
      .then(async () => {
        console.log("✅ MongoDB-তে সংযোগ সফল হয়েছে!");
        const database = client.db("maati");
        await ensureIndexes(database);
        return database;
      })
      .catch((err) => {
        connectPromise = null;
        console.error("❌ MongoDB সংযোগে সমস্যা:", err);
        throw err;
      });
  }
  return connectPromise;
}

export async function getDB() {
  return connectClient();
}

// আমাদের নিজেদের কালেকশনের index — user/session/account better-auth নিজে
// ম্যানেজ করে, তাই ওগুলোতে হাত দেওয়া হচ্ছে না
async function ensureIndexes(database) {
  try {
    await database
      .collection("carts")
      .createIndex({ userId: 1 }, { unique: true });
    await database.collection("orders").createIndex({ userId: 1 });
    await database.collection("orders").createIndex({ createdAt: -1 });
    await database.collection("products").createIndex({ category: 1 });
    await database.collection("products").createIndex({ sellerId: 1 });
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
