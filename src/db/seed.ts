import { eq } from "drizzle-orm";
import { getExpressDb } from "./client";
import { accountRoles, accounts } from "./schema";

const ADMIN_USER_DATA = {
  name: "admin",
  email: "ch47b07sa3l@gmail.com",
  passwordHash: "$2a$10$Fn3Y7Pxd7Yb3TMTsS2QYjOx9sOwUWIQfrMsVMr5xALfQ1K9fNnAXy",
  role: "admin",
  status: "active",
};

async function seed() {
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
}

seed()
  .then(() => {
    console.log("seed concluido");
    process.exit(0);
  })
  .catch((error) => {
    console.error("erro ao executar seed", error);
    process.exit(1);
  });
