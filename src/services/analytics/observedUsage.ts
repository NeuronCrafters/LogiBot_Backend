/** UTC reporting days, matching the existing dashboard date-filter contract. */
export function observedUsageByDay(intervals: Array<{ startedAt: Date; endedAt: Date }>, filters: { startDate?: string; endDate?: string }) {
  const lower = filters.startDate ? +new Date(filters.startDate) : -Infinity;
  let upper = filters.endDate ? +new Date(filters.endDate) : Infinity;
  if (filters.endDate && /^\d{4}-\d{2}-\d{2}$/.test(filters.endDate)) upper += 86400000;
  else if (Number.isFinite(upper)) upper += 1;
  const days = new Map<string, number>();
  for (const interval of intervals) {
    let start = Math.max(+interval.startedAt, lower);
    const end = Math.min(+interval.endedAt, upper);
    while (start < end) {
      const date = new Date(start).toISOString().slice(0, 10);
      const next = Math.min(+new Date(date) + 86400000, end);
      days.set(date, (days.get(date) || 0) + (next - start) / 1000);
      start = next;
    }
  }
  let running = 0, previous = 0;
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, seconds]) => {
    running += seconds;
    const value = Math.floor(running) - previous;
    previous += value;
    return { date, seconds: value };
  });
}
