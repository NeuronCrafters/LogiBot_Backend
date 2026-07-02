import request from "supertest";
import { app } from "../server";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

describe("Node Express app", () => {
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
    await request(app)
      .post("/dashboard/insights/chart")
      .send({ chart: "accuracy", filters: {} })
      .expect(401);
    await request(app)
      .post("/dashboard/insights/overview")
      .send({ filters: {} })
      .expect(401);
  });

  it("mounts major routers on the new English paths", async () => {
    await request(app).get("/auth/me").expect(401);
    await request(app).get("/academic/filters").expect(401);
    await request(app).get("/admin/students").expect(401);
    await request(app).post("/feedback").send({ message: "teste" }).expect(401);
  });
});
