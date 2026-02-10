import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectMongo() {
  if (!env.mongoUri) throw new Error("MONGODB_URI not set");
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
}
