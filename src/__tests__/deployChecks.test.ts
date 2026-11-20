import { checkEnvironment, checkExternalServices, checkImageStorage, databaseIdentity } from "../services/deploy/deployChecks";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";

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

describe("institution image storage", () => {
  const saved = process.env.INSTITUTION_IMAGE_DIR;
  afterEach(() => { if (saved === undefined) delete process.env.INSTITUTION_IMAGE_DIR; else process.env.INSTITUTION_IMAGE_DIR = saved; });

  it("is fine with a writable folder and fails when it cannot be written", () => {
    process.env.INSTITUTION_IMAGE_DIR = mkdtempSync(path.join(tmpdir(), "images-"));
    expect(checkImageStorage().status).toBe("ok");
    const file = path.join(mkdtempSync(path.join(tmpdir(), "images-")), "not-a-folder");
    writeFileSync(file, "x");
    process.env.INSTITUTION_IMAGE_DIR = file;
    expect(checkImageStorage().status).toBe("fail");
  });
});

describe("external services of the institution page", () => {
  it("is fine when ViaCEP and Nominatim answer, and only warns when they do not", async () => {
    const calls: string[] = [];
    const ok = (async (url: string) => { calls.push(String(url)); return new Response("[]", { status: 200 }); }) as unknown as typeof fetch;
    expect((await checkExternalServices(ok, {})).map((check) => check.status)).toEqual(["ok", "ok"]);
    expect(calls[0]).toBe("https://viacep.com.br/ws/01001000/json/");
    expect(calls[1]).toContain("https://nominatim.openstreetmap.org/search?");
    const offline = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect((await checkExternalServices(offline, {})).map((check) => check.status)).toEqual(["warn", "warn"]);
    const refused = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    expect((await checkExternalServices(refused, {}))[1].detail).toContain("429");
  });
});
