// config/auth.js
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client, connectClient } from "./db.js";

const db = await connectClient();

const IS_PROD = process.env.NODE_ENV === "production";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",

  database: mongodbAdapter(db, { client, transaction: false }),

  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

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

  user: {
    additionalFields: {
      number: { type: "string", required: false },
      address: { type: "string", required: false },
      bio: { type: "string", required: false },
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
  },

  trustedOrigins: [CLIENT_URL],
  advanced: {
    defaultCookieAttributes: {
      sameSite: IS_PROD ? "none" : "lax",
      secure: IS_PROD,
      httpOnly: true,
    },
  },
});
