import request from "supertest";
import { app } from "../server";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

describe("Node Express app", () => {
  afterEach(() => {
    delete process.env.METRICS_ENABLED;
    delete process.env.METRICS_API_KEY;
  });

  it("responds to simple health checks without opening a port", async () => {
    await request(app).get("/health/simple").expect(200, "OK");
    await request(app).get("/health/ping").expect(200, "pong");
  });

  it("reports node-express runtime on /health", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      runtime: "node-express",
      database: "ok",
    });
  });

  it("rejects protected routes without a session", async () => {
    await request(app).get("/quiz/levels").expect(401);
    await request(app).get("/dashboard/topic-performance").expect(401);
  });

  it("does not expose metrics when metrics are disabled", async () => {
    await request(app).get("/metrics").expect(404);
  });

  it("does not expose metrics when the metrics key is missing", async () => {
    process.env.METRICS_ENABLED = "true";

    await request(app).get("/metrics").expect(503);
  });

  it("requires the metrics bearer token when metrics are enabled", async () => {
    process.env.METRICS_ENABLED = "true";
    process.env.METRICS_API_KEY = "test-metrics-key";

    await request(app).get("/metrics").expect(401);
    await request(app)
      .get("/metrics")
      .set("Authorization", "Bearer wrong-key")
      .expect(401);
  });

  it("returns prometheus metrics with the correct bearer token", async () => {
    process.env.METRICS_ENABLED = "true";
    process.env.METRICS_API_KEY = "test-metrics-key";

    const response = await request(app)
      .get("/metrics")
      .set("Authorization", "Bearer test-metrics-key")
      .expect(200);

    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("# HELP logibot_");
  });

  it("mounts major routers on the new English paths", async () => {
    await request(app).get("/auth/me").expect(401);
    await request(app).get("/academic/filters").expect(401);
    await request(app).get("/admin/students").expect(401);
    await request(app).post("/feedback").send({ message: "teste" }).expect(401);
  });
});
