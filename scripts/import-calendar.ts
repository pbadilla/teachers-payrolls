// Loads the "calendario" Excel into the payrolls API: the attendance calendar of each month and the
// teachers of its "Profes" tables that don't exist yet. Payrolls are not touched (use "Aplicar a la nòmina").
//
//   bun scripts/import-calendar.ts "src/data/calendario 2026.xlsx" --year 2026 [--alias Maty=Matias] [--from 2026-09] [--write]
//
// Months before --from (September 2026 by default) are skipped.
// Without --write it only prints what it would do. Unknown names are kept as the day's note, and the
// second (blue) row goes to the activity "Particulars" (created when missing).
import * as XLSX from "@e965/xlsx";
import { readFileSync } from "node:fs";
import { normalizeName } from "../src/lib/calendar";
import { analyzeCalendarImport, buildCalendarImport, parseCalendarWorkbook } from "../src/lib/calendar-import";
import { createId } from "../src/lib/id";
import type { CalendarMonth } from "../src/types/calendar";
import type { Activity, Teacher } from "../src/types/teacher";

const args = process.argv.slice(2);
const option = (name: string) => args.filter((_, index) => args[index - 1] === name);
const file = args.find((arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--"));
const api = option("--api")[0] ?? process.env.PAYROLLS_API_URL ?? "http://localhost:3004/api";
const year = option("--year")[0];
// Months before this one are skipped: the club only keeps data from September 2026 on.
const from = option("--from")[0] ?? "2026-09";
const write = args.includes("--write");
const aliases = Object.fromEntries(option("--alias").map((pair) => pair.split("=") as [string, string]));
if (!file) throw new Error("Usage: bun scripts/import-calendar.ts <file.xlsx> [--year 2026] [--alias Maty=Matias] [--write]");

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${api}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
};

const workbook = XLSX.read(readFileSync(file), { cellFormula: true });
const months = parseCalendarWorkbook(workbook, XLSX.utils)
  .filter((month) => month.month >= from && (!year || month.month.startsWith(year)) && Object.keys(month.days).length);
const { teachers, activities } = await request<{ teachers: Teacher[]; activities: Activity[] }>("/data");
// The second (blue) row of the Excel is the private lessons: the activity "Particulars".
const existingParticulars = activities.find((item) => item.kind !== "school" && normalizeName(item.name) === "particulars");
const particulars: Activity = existingParticulars ?? { id: createId(), name: "Particulars", kind: "activity" };
const analysis = analyzeCalendarImport(months, teachers);
const result = buildCalendarImport(months, teachers, { people: analysis.newPeople, names: [], aliases, extraActivityId: particulars.id });
const kept = analysis.unknownNames.filter((item) => !aliases[item.name]);

console.log(`Months: ${months.map((month) => `${month.sheet} (${Object.keys(month.days).length} days)`).join(", ")}`);
console.log(`New teachers: ${result.teachers.map((teacher) => `${teacher.name} (${teacher.type}, ${teacher.hourlyRate} €)`).join(", ") || "none"}`);
console.log(`Aliases: ${Object.entries(aliases).map(([from, to]) => `${from} → ${to}`).join(", ") || "none"}`);
console.log(`Kept as notes: ${kept.map((item) => `${item.name} ×${item.count}`).join(", ") || "none"}`);

const existing = await Promise.all(result.months.map((month) => request<CalendarMonth>(`/calendar/${month.month}`)));
const replaced = existing.filter((month) => Object.keys(month.days).length).map((month) => month.month);
if (replaced.length) console.log(`These months already have a calendar and will be replaced: ${replaced.join(", ")}`);

if (!write) {
  console.log("\nDry run: nothing written. Add --write to import.");
} else {
  if (!existingParticulars) await request("/activities", { method: "POST", body: JSON.stringify(particulars) });
  if (result.teachers.length) await request("/import", { method: "POST", body: JSON.stringify({ teachers: result.teachers }) });
  for (const month of result.months) await request(`/calendar/${month.month}`, { method: "PUT", body: JSON.stringify(month) });
  console.log(`\nImported ${result.months.length} months and ${result.teachers.length} new teachers.`);
}
