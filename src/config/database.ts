import dotenv from "dotenv";
import { checkDatabase, getExpressDb } from "../db/client";
import { logger } from "../logger";

dotenv.config();

export async function connectDB(): Promise<void> {
  try {
    await checkDatabase(getExpressDb());
  } catch (error) {
    logger.error("Database", "Failed to connect to PostgreSQL.", error);
    process.exit(1);
  }
}
