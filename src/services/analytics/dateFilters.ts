import { gte, lt, lte, type AnyColumn, type SQL } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";

type Period = { startDate?: string; endDate?: string };

export function dateConditions(column: AnyColumn, filters: Period): SQL[] {
  const conditions: SQL[] = [];
  const parse = (value: string, field: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || (/^\d{4}-\d{2}-\d{2}$/.test(value) && date.toISOString().slice(0, 10) !== value))
      throw new AppError({ key: "validation.fieldInvalid", params: { value0: field } }, 400);
    return date;
  };
  const start = filters.startDate ? parse(filters.startDate, "startDate") : undefined;
  const end = filters.endDate ? parse(filters.endDate, "endDate") : undefined;
  if (start && end && start > end)
    throw new AppError({ key: "validation.fieldInvalid", params: { value0: "endDate" } }, 400);
  if (start) conditions.push(gte(column, start));
  if (end) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(filters.endDate!)) {
      end.setUTCDate(end.getUTCDate() + 1);
      conditions.push(lt(column, end));
    } else conditions.push(lte(column, end));
  }
  return conditions;
}
