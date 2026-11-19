/** Test accounts live only in the sandbox database and use this e-mail domain. */
export const SANDBOX_EMAIL_DOMAIN = (process.env.SANDBOX_EMAIL_DOMAIN || "dev.sael.com").toLowerCase();

export const isSandboxEmail = (email: unknown) =>
  typeof email === "string" && email.trim().toLowerCase().endsWith("@" + SANDBOX_EMAIL_DOMAIN);

/** Platform owners (support): admins listed here can enter the test environment. */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS || "owner@logibots.com").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export const isOwner = (user: { email: string; role: string[] } | undefined) =>
  !!user && user.role.includes("admin") && ownerEmails().indexOf(user.email.toLowerCase()) !== -1;

export const SANDBOX_STUDENT_COUNT = 30;
export const sandboxEmail = (local: string) => `${local}@${SANDBOX_EMAIL_DOMAIN}`;
