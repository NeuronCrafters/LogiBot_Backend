const queryQuestions = jest.fn();
const registeredTopics = jest.fn();
const query: Record<string, jest.Mock> = {};
for (const key of ["selectDistinct", "from", "innerJoin"]) query[key] = jest.fn(() => query);
query.where = registeredTopics;
jest.mock("../db/client", () => ({ getDb: () => query }));
jest.mock("../services/analytics/analyticsService", () => ({
  queryQuestions: (...args: unknown[]) => queryQuestions(...args),
  aggregateByCategory: jest.requireActual("../services/analytics/analyticsService").aggregateByCategory,
}));
import { getProficiencyRadar } from "../services/dashboard/dashboardService";

describe("proficiency topic catalog", () => {
  beforeEach(() => { queryQuestions.mockReset(); registeredTopics.mockReset(); });
  it("retains registered and historical topics without manufacturing answers", async () => {
    queryQuestions.mockResolvedValueOnce([{ subject: "Python", isCorrect: false }]);
    queryQuestions.mockResolvedValueOnce([{ subject: "Python", isCorrect: false }, { subject: "Arrays", isCorrect: true }]);
    registeredTopics.mockResolvedValue([{ topic: "Unused topic" }]);
    const filters = { universityId: "university", courseId: "course", classId: "class", studentId: "student", startDate: "2026-11-01" };
    const result = await getProficiencyRadar(filters);
    expect(result).toEqual({ labels: ["Arrays", "Python", "Unused topic"], data: [null, 0, null] });
    expect(queryQuestions).toHaveBeenNthCalledWith(2, { ...filters, classId: undefined, studentId: undefined, startDate: undefined, endDate: undefined });
  });
  it("keeps all catalog axes when a student has no answers", async () => {
    queryQuestions.mockResolvedValueOnce([]).mockResolvedValueOnce([{ subject: "Python", isCorrect: true }]);
    registeredTopics.mockResolvedValue([{ topic: "Arrays" }]);
    await expect(getProficiencyRadar({ universityId: "university" })).resolves.toEqual({ labels: ["Arrays", "Python"], data: [null, null] });
  });
});
