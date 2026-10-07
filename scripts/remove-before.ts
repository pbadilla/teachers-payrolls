// Removes the calendar and the payroll (records and paid/locked state) of every month before a given
// one, and the teachers who only appear in those months. Locked payrolls are refused by the API and
// reported. Schools and activities are kept.
//
//   bun scripts/remove-before.ts 2026-09 [--write]
import { normalizeDay } from "../src/lib/calendar";
import type { CalendarMonth } from "../src/types/calendar";
import type { MonthlyRecord, PayrollMonthState, Teacher } from "../src/types/teacher";

const api = process.env.PAYROLLS_API_URL ?? "http://localhost:3004/api";
const before = process.argv.slice(2).find((arg) => /^\d{4}-(0[1-9]|1[0-2])$/.test(arg));
const write = process.argv.includes("--write");
if (!before) throw new Error("Usage: bun scripts/remove-before.ts <YYYY-MM> [--write]");

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  // A JSON content type without a body is refused by the API (DELETE requests have none).
  const response = await fetch(`${api}${path}`, { ...init, headers: init?.body ? { "Content-Type": "application/json" } : {} });
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
};

// Every month from 2020 up to the given one (exclusive).
const months: string[] = [];
for (let year = 2020; ; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key >= before) break;
    months.push(key);
  }
  if (`${year + 1}-01` > before) break;
}

const { teachers, records, payrollMonths } = await request<{ teachers: Teacher[]; records: MonthlyRecord[]; payrollMonths: PayrollMonthState[] }>("/data");
const calendars = (await Promise.all(months.map((month) => request<CalendarMonth>(`/calendar/${month}`))))
  .filter((calendar) => Object.keys(calendar.days).length || calendar.socialSecurity !== undefined || calendar.schoolIncome !== undefined);
const payrolls = [...new Set([...records.map((record) => record.month), ...payrollMonths.map((state) => state.month)])]
  .filter((month) => month < before)
  .sort();

// Teachers who only have data before that month (in the calendar or the payroll) are removed too.
// Teachers with data from that month on, or with no data at all (just added), are kept.
const teacherIdsOf = (calendar: CalendarMonth) => Object.values(calendar.days).flatMap((raw) => {
  const day = normalizeDay(raw);
  return [...day.main, ...day.extra, ...(day.assignments ?? []).flatMap((assignment) => assignment.teacherIds)];
}).concat(Object.keys(calendar.rates ?? {}), Object.keys(calendar.adjustments ?? {}));
const later: string[] = [];
for (let year = Number(before.slice(0, 4)); year <= Number(before.slice(0, 4)) + 4; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key >= before) later.push(key);
  }
}
const laterCalendars = await Promise.all(later.map((month) => request<CalendarMonth>(`/calendar/${month}`)));
const keep = new Set([
  ...laterCalendars.flatMap(teacherIdsOf),
  ...records.filter((record) => record.month >= before && (record.hours > 0 || record.adjustment)).map((record) => record.teacherId),
]);
const old = new Set([...calendars.flatMap(teacherIdsOf), ...records.filter((record) => record.month < before).map((record) => record.teacherId)]);
const oldTeachers = teachers.filter((teacher) => old.has(teacher.id) && !keep.has(teacher.id));

console.log(`Calendar months before ${before}: ${calendars.map((calendar) => `${calendar.month} (${Object.keys(calendar.days).length} days)`).join(", ") || "none"}`);
console.log(`Payroll months before ${before}: ${payrolls.map((month) => `${month} (${records.filter((record) => record.month === month).length} records${payrollMonths.find((state) => state.month === month)?.locked ? ", LOCKED" : ""})`).join(", ") || "none"}`);
console.log(`Teachers only in those months (${oldTeachers.length}): ${oldTeachers.map((teacher) => teacher.name).join(", ") || "none"}`);
console.log(`Teachers kept: ${teachers.length - oldTeachers.length}`);

if (!write) console.log("\nDry run: nothing removed. Add --write to remove.");
else {
  for (const calendar of calendars) await request(`/calendar/${calendar.month}`, { method: "DELETE" });
  // Removing a teacher also removes their payroll records and unlinks them from the schools.
  for (const teacher of oldTeachers) await fetch(`${api}/teachers/${teacher.id}`, { method: "DELETE" });
  console.log(`Removed ${oldTeachers.length} teachers.`);
  const refused: string[] = [];
  for (const month of payrolls) {
    try { await request(`/records/${month}`, { method: "DELETE" }); } catch (error) { refused.push(`${month}: ${(error as Error).message}`); }
  }
  console.log(`\nRemoved ${calendars.length} calendar months and ${payrolls.length - refused.length} payroll months.`);
  if (refused.length) console.log(`Not removed:\n  ${refused.join("\n  ")}`);
}
