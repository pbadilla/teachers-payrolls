// Turns the day notes typed in the Excel ("Festiu :(", "festa", "Lluvia", "Portes obertes") into the
// day's incidents. A note made only of those words is removed; any other text is kept.
//
//   bun scripts/migrate-notes-to-incidents.ts [--write]
import { normalizeDay } from "../src/lib/calendar";
import type { CalendarMonth, DayIncident } from "../src/types/calendar";

const api = process.env.PAYROLLS_API_URL ?? "http://localhost:3004/api";
const write = process.argv.includes("--write");
// Named holidays: the day is a holiday and the name stays as the note.
const NAMED_HOLIDAYS = /(?<!\p{L})(la merc[eè]|sant joan|nadal|diada)(?!\p{L})/iu;
const RULES: [DayIncident, RegExp][] = [
  ["holiday", /\b(festiu|festa|festivo)\b/giu],
  ["rain", /\b(pluja|plou|lluvia|llueve)\b/giu],
  ["open-day", /\b(portes obertes|puertas abiertas)\b/giu],
];

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${api}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
};

const months = Array.from({ length: 16 * 12 }, (_, index) => `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`);
const calendars = (await Promise.all(months.map((month) => request<CalendarMonth>(`/calendar/${month}`))))
  .filter((calendar) => Object.values(calendar.days).some((day) => day.note));

const changed: CalendarMonth[] = [];
for (const calendar of calendars) {
  let touched = false;
  const days = Object.fromEntries(Object.entries(calendar.days).map(([date, raw]) => {
    const day = normalizeDay(raw);
    if (!day.note) return [date, day];
    const incidents = new Set(day.incidents ?? []);
    let rest = day.note;
    for (const [incident, pattern] of RULES) {
      if (pattern.test(rest)) { incidents.add(incident); rest = rest.replace(pattern, ""); }
      pattern.lastIndex = 0;
    }
    if (NAMED_HOLIDAYS.test(rest)) incidents.add("holiday");
    if (incidents.size === (day.incidents ?? []).length) return [date, day];
    touched = true;
    // Only punctuation or emoticons left ("Festiu :(", "Festiu :( · Festiu :(") → no note.
    const note = /[\p{L}\p{N}]/u.test(rest) ? rest.replace(/\s+/g, " ").replace(/^[\s·:(),.-]+|[\s·:(),.-]+$/g, "") : "";
    console.log(`  ${date}: "${day.note}" → ${[...incidents].join(", ")}${note ? ` · note "${note}"` : ""}`);
    const { note: _note, ...others } = day;
    return [date, { ...others, incidents: [...incidents], ...(note ? { note } : {}) }];
  }));
  if (touched) changed.push({ ...calendar, days });
}
if (!changed.length) console.log("No notes to convert.");

if (!write) console.log("\nDry run: nothing written. Add --write to convert.");
else {
  for (const calendar of changed) await request(`/calendar/${calendar.month}`, { method: "PUT", body: JSON.stringify(calendar) });
  console.log(`\nConverted the notes of ${changed.length} months.`);
}
