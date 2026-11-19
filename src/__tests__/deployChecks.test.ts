import { checkEnvironment, databaseIdentity } from "../services/deploy/deployChecks";

const statusOf = (env: NodeJS.ProcessEnv, name: string) => checkEnvironment(env).find((check) => check.name === name)?.status;
const base = { DATABASE_URL: "postgres://u:p@db:5432/logibot", JWT_SECRET: "x".repeat(40), OWNER_EMAILS: "owner@logibots.com" };

describe("pre-deploy configuration checks", () => {
  it("identifies the database by host, port and name", () => {
    expect(databaseIdentity("postgres://a:b@127.0.0.1/logibot?ssl=true")).toBe("localhost:5432/logibot");
    expect(databaseIdentity("nope")).toBeNull();
  });

  it("fails when the test database is the main one, even written differently", () => {
    const env = { ...base, SANDBOX_DATABASE_URL: "postgres://other:pw@db:5432/logibot?application_name=x", SANDBOX_PASSWORD: "y".repeat(12) };
    expect(statusOf(env, "SANDBOX_DATABASE_URL")).toBe("fail");
    expect(statusOf({ ...env, SANDBOX_DATABASE_URL: "postgres://u:p@db:5432/logibots_sandbox" }, "SANDBOX_DATABASE_URL")).toBe("ok");
  });

  it("requires the main secrets and a strong test password", () => {
    expect(statusOf({}, "DATABASE_URL")).toBe("fail");
    expect(statusOf({ ...base, JWT_SECRET: "" }, "JWT_SECRET")).toBe("fail");
    expect(statusOf({ ...base, JWT_SECRET: "short" }, "JWT_SECRET")).toBe("warn");
    expect(statusOf({ ...base, SANDBOX_DATABASE_URL: "postgres://u:p@db/sandbox", SANDBOX_PASSWORD: "short" }, "SANDBOX_PASSWORD")).toBe("fail");
    expect(statusOf(base, "SANDBOX_DATABASE_URL")).toBe("warn");
    expect(checkEnvironment(base).every((check) => check.status !== "fail")).toBe(true);
  });
});
