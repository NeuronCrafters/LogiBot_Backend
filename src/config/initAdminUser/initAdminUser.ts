import { eq } from "drizzle-orm";
import { getExpressDb } from "../../db/client";
import { accountRoles, accounts } from "../../db/schema";

const ADMIN_USER_DATA = {
  name: "admin",
  email: "ch47b07sa3l@gmail.com",
  passwordHash: "$2a$10$EmiRe/ZX5XLSN1JJp/GJ.O87MELljrlQBtabyJUyp7z/lwLKshBfW",
  role: "admin",
  status: "active",
};

export async function initAdminUser(): Promise<void> {
  try {
    const db = getExpressDb();
    const existing = await db.query.accounts.findFirst({
      where: eq(accounts.email, ADMIN_USER_DATA.email),
    });

    const [account] = existing
      ? await db.update(accounts)
        .set({
          name: ADMIN_USER_DATA.name,
          passwordHash: ADMIN_USER_DATA.passwordHash,
          status: ADMIN_USER_DATA.status,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existing.id))
        .returning()
      : await db.insert(accounts)
        .values({
          name: ADMIN_USER_DATA.name,
          email: ADMIN_USER_DATA.email,
          passwordHash: ADMIN_USER_DATA.passwordHash,
          status: ADMIN_USER_DATA.status,
        })
        .returning();

    await db.insert(accountRoles)
      .values({ accountId: account.id, role: ADMIN_USER_DATA.role })
      .onConflictDoNothing();
  } catch (error) {
    console.error("erro ao inicializar admin:", error);
  }
}
