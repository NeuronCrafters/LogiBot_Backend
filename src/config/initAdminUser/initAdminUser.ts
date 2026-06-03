import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getExpressDb } from "../../db/client";
import { accountRoles, accounts } from "../../db/schema";
import { logger } from "../../logger";

const ADMIN_USER_DATA = {
  name: "admin",
  email: "admin@logibot.com",
  password: "admin@logibot.com",
  role: "admin",
  status: "active",
};

export async function initAdminUser(): Promise<void> {
  try {
    const db = getExpressDb();
    const passwordHash = await bcrypt.hash(ADMIN_USER_DATA.password, 10);
    const existing = await db.query.accounts.findFirst({
      where: eq(accounts.email, ADMIN_USER_DATA.email),
    });

    const [account] = existing
      ? await db.update(accounts)
        .set({
          name: ADMIN_USER_DATA.name,
          passwordHash,
          status: ADMIN_USER_DATA.status,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existing.id))
        .returning()
      : await db.insert(accounts)
        .values({
          name: ADMIN_USER_DATA.name,
          email: ADMIN_USER_DATA.email,
          passwordHash,
          status: ADMIN_USER_DATA.status,
        })
        .returning();

    await db.insert(accountRoles)
      .values({ accountId: account.id, role: ADMIN_USER_DATA.role })
      .onConflictDoNothing();
  } catch (error) {
    logger.error("Bootstrap", "Failed to initialize admin account.", error);
    throw error;
  }
}
