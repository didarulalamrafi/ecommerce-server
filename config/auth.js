// config/auth.js
// এখানে better-auth সেটআপ হচ্ছে — register/login/logout/session সবকিছুর
// আসল লজিক এখন better-auth handle করে, আমাদের নিজেদের বানানো bcrypt/JWT
// কোড আর দরকার নেই।
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client, connectClient } from "./db.js";

const db = await connectClient(); // top-level await — ESM এ কাজ করে

const IS_PROD = process.env.NODE_ENV === "production";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

export const auth = betterAuth({
  // UPDATED: free-tier/shared MongoDB cluster এ transaction ঠিকভাবে কাজ
  // না করার কারণে "MongoTransactionError" আসছিল — transaction: false
  // দিয়ে বন্ধ করে দেওয়া হলো, better-auth তখন sequential operation
  // ব্যবহার করবে (সামান্য স্লো কিন্তু নির্ভরযোগ্য)
  database: mongodbAdapter(db, { client, transaction: false }),

  secret: process.env.BETTER_AUTH_SECRET, // .env এ দিতে হবে — openssl rand -base64 32

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  // NEW: Google/Facebook দিয়ে সরাসরি লগইন — তোমার পুরনো Next.js এর
  // lib/auth.ts এ এই কনফিগ ছিল, এখানে carry over করা হলো। callback URL
  // এখন Express backend এর domain এ পয়েন্ট করবে (নিচের নোট দেখো)
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    },
  },

  // NEW: আমাদের কাস্টম ফিল্ড — role (admin/user), আর প্রোফাইল ফিল্ডগুলো
  // এখন better-auth এর user document এই থাকবে, আলাদা কালেকশন লাগবে না
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // ইউজার সাইনআপের সময় নিজে থেকে "admin" বসাতে পারবে না
      },
      number: { type: "string", required: false },
      address: { type: "string", required: false },
      bio: { type: "string", required: false },
    },
  },

  // frontend (ecommerce) আর backend (ecommerce-server) আলাদা Vercel domain
  // এ থাকায় এই দুইটা সেটিং জরুরি
  trustedOrigins: [CLIENT_URL],
  advanced: {
    defaultCookieAttributes: {
      sameSite: IS_PROD ? "none" : "lax",
      secure: IS_PROD,
      httpOnly: true,
    },
  },
});

// ================================================================
// প্রথম admin বানাতে চাইলে:
// ১. সাইটে normal ইউজার হিসেবে register করো
// ২. MongoDB Atlas এ গিয়ে "user" collection এ ওই ইউজারের role: "user"
//    থেকে role: "admin" এ ম্যানুয়ালি বদলে দাও
// ================================================================
//
// ⚠️ Google/Facebook OAuth callback URL — জরুরি পরিবর্তন:
// auth আগে Next.js এ ছিল, তখন redirect URI ছিল frontend domain এ:
//   https://<তোমার-next-app>.vercel.app/api/auth/callback/google
// এখন auth Express backend এ, তাই redirect URI backend domain এ বদলাতে হবে:
//   https://<তোমার-express-backend>.vercel.app/api/auth/callback/google
//   https://<তোমার-express-backend>.vercel.app/api/auth/callback/facebook
// এই URL গুলো Google Cloud Console (Credentials > OAuth Client) এবং
// Meta for Developers (Facebook App > Valid OAuth Redirect URIs) এ গিয়ে
// আপডেট করতে হবে — নাহলে "redirect_uri_mismatch" এরর আসবে।
// ================================================================
