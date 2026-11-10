import { PgDialect } from "drizzle-orm/pg-core";
import { answerQuestions } from "../db/schema";
import { dateConditions } from "../services/analytics/dateFilters";

const dialect = new PgDialect();
describe("analytics calendar periods", () => {
  it("includes the whole end date and excludes the next day", () => {
    const queries = dateConditions(answerQuestions.timestamp, { startDate: "2026-08-24", endDate: "2026-08-26" }).map((condition) => dialect.sqlToQuery(condition));
    expect(queries[0].sql).toContain(">=");
    expect(queries[0].params).toEqual(["2026-08-24T00:00:00.000Z"]);
    expect(queries[1].sql).toContain(" < ");
    expect(queries[1].params).toEqual(["2026-08-27T00:00:00.000Z"]);
  });
  it("defaults to the full history", () => {
    expect(dateConditions(answerQuestions.timestamp, {})).toEqual([]);
  });
  it.each([{ startDate: "invalid" }, { endDate: "2026-02-30" }, { startDate: "2026-11-10", endDate: "2026-08-01" }])("rejects invalid or reversed periods %j", (filters) => {
    expect(() => dateConditions(answerQuestions.timestamp, filters)).toThrow();
  });
});
