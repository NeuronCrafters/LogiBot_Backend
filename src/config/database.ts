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

    console.log("conexão com o mongodb estabelecida com sucesso!");
  } catch (error) {
    console.error("erro ao conectar no mongodb:", error);
    process.exit(1);
  }
}
