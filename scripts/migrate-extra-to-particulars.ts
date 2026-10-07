// Moves the teachers of the Excel's second (blue) row of every calendar month into the activity
// "Particulars", creating it when it doesn't exist. Each teacher keeps one session, so the payrolls
// don't change. Running it again does nothing.
//
//   bun scripts/migrate-extra-to-particulars.ts [--write]
import { createId } from "../src/lib/id";
import { normalizeDay, normalizeName } from "../src/lib/calendar";
import type { CalendarMonth } from "../src/types/calendar";
import type { Activity } from "../src/types/teacher";

const api = process.env.PAYROLLS_API_URL ?? "http://localhost:3004/api";
const write = process.argv.includes("--write");
export const PARTICULARS = "Particulars";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${api}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
};

const { activities } = await request<{ activities: Activity[] }>("/data");
const existing = activities.find((item) => item.kind !== "school" && normalizeName(item.name) === normalizeName(PARTICULARS));
const particulars: Activity = existing ?? { id: createId(), name: PARTICULARS, kind: "activity" };
console.log(existing ? `Activity "${PARTICULARS}" exists.` : `Activity "${PARTICULARS}" will be created.`);

// Every month that can hold a calendar: 2020–2035 is plenty for this club.
const months = Array.from({ length: 16 * 12 }, (_, index) => `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
const calendars = (await Promise.all(months.map((month) => request<CalendarMonth>(`/calendar/${month}`))))
  .filter((calendar) => Object.values(calendar.days).some((day) => day.extra?.length || day.extraActivities));

const updated = calendars.map((calendar) => {
  let moved = 0;
  const days = Object.fromEntries(Object.entries(calendar.days).map(([date, raw]) => {
    const day = normalizeDay(raw);
    if (!day.extra.length) return [date, day];
    moved += day.extra.length;
    const assignments = [...(day.assignments ?? [])];
    const index = assignments.findIndex((item) => item.activityId === particulars.id);
    const teacherIds = [...new Set([...(index >= 0 ? assignments[index].teacherIds : []), ...day.extra])];
    if (index >= 0) assignments[index] = { activityId: particulars.id, teacherIds };
    else assignments.push({ activityId: particulars.id, teacherIds });
    return [date, { ...day, extra: [], assignments }];
  }));
  console.log(`  ${calendar.month}: ${moved} teachers of the blue row → ${PARTICULARS}`);
  return { ...calendar, days };
});
if (!updated.length) console.log("No month has teachers in the blue row.");

if (!write) console.log("\nDry run: nothing written. Add --write to migrate.");
else {
  if (!existing) await request("/activities", { method: "POST", body: JSON.stringify(particulars) });
  for (const calendar of updated) await request(`/calendar/${calendar.month}`, { method: "PUT", body: JSON.stringify(calendar) });
  console.log(`\nMigrated ${updated.length} months.`);
}
