import dotenv from "dotenv";
import { checkDatabase, getExpressDb } from "../db/client";

dotenv.config();

export async function connectDB(): Promise<void> {
  try {
    await checkDatabase(getExpressDb());
  } catch (error) {
    console.error("erro ao conectar ao PostgreSQL:", error);
    process.exit(1);
  }
}
