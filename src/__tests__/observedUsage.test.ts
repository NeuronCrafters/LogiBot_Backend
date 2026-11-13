import { observedUsageByDay } from "../services/analytics/observedUsage";

it("splits a checkpoint across midnight and keeps exact totals", () => {
  const intervals = [{ startedAt: new Date("2026-11-12T23:59:45Z"), endedAt: new Date("2026-11-13T00:00:15Z") }];
  expect(observedUsageByDay(intervals, {})).toEqual([{ date: "2026-11-12", seconds: 15 }, { date: "2026-11-13", seconds: 15 }]);
  expect(observedUsageByDay(intervals, { startDate: "2026-11-13", endDate: "2026-11-13" })).toEqual([{ date: "2026-11-13", seconds: 15 }]);
});

it("does not round every small interval up into extra time", () => {
  const intervals = [{ startedAt: new Date(0), endedAt: new Date(700) }, { startedAt: new Date(700), endedAt: new Date(1400) }];
  expect(observedUsageByDay(intervals, {})[0].seconds).toBe(1);
});
