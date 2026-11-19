import request from "supertest";
import { app } from "../server";
import { buildNotificationEmail } from "../services/notifications/notificationService";

jest.mock("../db/client", () => ({
  checkDatabase: jest.fn(async () => undefined),
  closeDatabasePool: jest.fn(async () => undefined),
  getDb: jest.fn(),
  getExpressDb: jest.fn(),
}));

describe("notification e-mails", () => {
  const recipient = { id: "id", name: "Ana <b>", email: "ana@example.invalid", preferredLanguage: "en-US" };

  it("are written in the recipient's language and escape user content in HTML", () => {
    const mail = buildNotificationEmail(recipient, "quiz_published", { quizTitle: "Loops <script>", disciplineName: "Logic & Co" }, "https://app.example/quiz/1");
    expect(mail.subject).toBe("New quiz in your class: Loops <script>");
    expect(mail.html).toContain("Loops &lt;script&gt;");
    expect(mail.html).toContain("Logic &amp; Co");
    expect(mail.html).toContain("Ana &lt;b&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain("https://app.example/quiz/1");
  });

  it("fall back to Portuguese without a preferred language", () => {
    const mail = buildNotificationEmail({ ...recipient, preferredLanguage: null }, "quiz_completion_progress",
      { quizTitle: "Q", completed: 3, total: 10, lastStudentName: "Bia" }, "https://app.example/quiz/manage");
    expect(mail.subject).toBe("3 de 10 alunos concluíram “Q”");
  });
});

describe("notification routes", () => {
  it("require a session", async () => {
    await request(app).get("/notifications").expect(401);
    await request(app).post("/notifications/read-all").expect(401);
    await request(app).put("/notifications/preferences").send({ emailEnabled: true }).expect(401);
  });
});
