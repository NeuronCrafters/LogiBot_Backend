import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export async function connectDB(): Promise<void> {
  try {
    const uri = process.env.MONGO_URI as string;

    if (!uri) {
      throw new Error("MONGO_URI não está configurada no .env");
    }

    await mongoose.connect(uri, {
      // Essas opções já não são mais necessárias nas versões mais recentes do Mongoose,
      // Mas fica aí de dica para projetos "legados"
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    });

    console.log("Conexão com o MongoDB estabelecida com sucesso!");
  } catch (error) {
    console.error("Erro ao conectar no MongoDB:", error);
    process.exit(1);
  }
}
