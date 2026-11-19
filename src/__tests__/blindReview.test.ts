import { computeGrade } from "../services/exams/blindReviewService";

jest.mock("../db/client", () => ({ getDb: jest.fn() }));

describe("grade (RF58)", () => {
  it("is 10 × weighted credit / total weight, rounded to hundredths", () => {
    expect(computeGrade([{ weight: 1, credit: 1 }, { weight: 2, credit: 1 }, { weight: 1, credit: 0.5 }])).toBe(8.75);
    expect(computeGrade([{ weight: 1, credit: 0 }, { weight: 2, credit: 0.5 }, { weight: 1, credit: 0 }])).toBe(2.5);
    expect(computeGrade([{ weight: 3, credit: 1 }, { weight: 0.5, credit: 0 }])).toBe(8.57);
    expect(computeGrade([])).toBe(0);
  });
});
