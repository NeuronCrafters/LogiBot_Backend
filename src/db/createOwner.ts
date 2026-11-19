import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDatabasePool, getDb } from "./client";
import { accountRoles, accounts } from "./schema";
import { logger } from "../logger";
import { ownerEmails } from "../services/sandbox/sandboxConfig";

/**
 * Creates the platform owner account (admin) in the main database if it does not exist yet.
 * Never changes an existing account. Password from OWNER_PASSWORD (12+ characters).
 */
async function main() {
  const email = ownerEmails()[0];
  const password = process.env.OWNER_PASSWORD || "";
  if (!email) throw new Error("OWNER_EMAILS is empty.");
  if (password.length < 12) throw new Error("OWNER_PASSWORD must have at least 12 characters.");
  const db = getDb();
  const [existing] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.email, email)).limit(1);
  if (existing) {
    logger.info("Owner", "Owner account already exists; nothing changed.");
    return;
  }
  const [account] = await db.insert(accounts).values({ name: "Owner LogiBots", email, passwordHash: await bcrypt.hash(password, 10), status: "active", preferredLanguage: "pt-BR" }).returning({ id: accounts.id });
  await db.insert(accountRoles).values({ accountId: account.id, role: "admin" });
  logger.info("Owner", "Owner account created.");
}

main()
  .then(async () => { await closeDatabasePool(); process.exit(0); })
  .catch(async (error) => { logger.error("Owner", "Failed to create the owner account.", error); await closeDatabasePool(); process.exit(1); });
