import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export async function connectDB(): Promise<void> {
  try {
    const uri = process.env.MONGO_URI as string;

    if (!uri) {
      throw new Error("mongo_uri não está configurada no .env");
    }

    await mongoose.connect(uri, {
    });


  } catch (error) {

    process.exit(1);
  }
}
