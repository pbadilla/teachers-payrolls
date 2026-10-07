// Loads the schools' activity groups exported from the registrations system ("Subcategories", e.g.
// "Sant marti Dimarts") into the payrolls API: one activity per group, linked to its school, with its
// weekday, places and code. Schools that don't exist yet are created. Running it again updates the
// same activities (matched by code) instead of duplicating them.
//
//   bun scripts/import-school-activities.ts scripts/data/escoles-26-27.csv [--write]
import { readFileSync } from "node:fs";
import { createId } from "../src/lib/id";
import { schoolKey, WEEK_DAY_NAMES } from "../src/lib/school-colors";
import type { Activity } from "../src/types/teacher";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const api = process.env.PAYROLLS_API_URL ?? "http://localhost:3004/api";
const write = args.includes("--write");
if (!file) throw new Error("Usage: bun scripts/import-school-activities.ts <file.csv> [--write]");

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${api}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
};

const [header, ...lines] = readFileSync(file, "utf8").trim().split(/\r?\n/);
const columns = header.split(",");
const rows = lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [columns[index], value.trim()])));

const { activities } = await request<{ activities: Activity[] }>("/data");
const schools = activities.filter((item) => item.kind === "school");
const newSchools: Activity[] = [];
const upserts: Activity[] = [];

for (const row of rows) {
  // "Escola Gaia Dijous" → school "Escola Gaia", weekday Thursday.
  const dayIndex = WEEK_DAY_NAMES.findIndex((day) => new RegExp(`\\s${day}$`, "i").test(row.name));
  const schoolName = dayIndex >= 0 ? row.name.slice(0, -WEEK_DAY_NAMES[dayIndex].length).trim() : row.name;
  let school = [...schools, ...newSchools].find((item) => schoolKey(item.name) === schoolKey(schoolName));
  if (!school) {
    school = { id: createId(), name: schoolName, kind: "school" };
    newSchools.push(school);
  }
  const existing = activities.find((item) => item.kind !== "school" && item.code === row.code);
  upserts.push({
    ...existing,
    id: existing?.id ?? createId(),
    name: row.name,
    kind: "activity",
    schoolId: school.id,
    code: row.code,
    category: row.category,
    ...(dayIndex >= 0 ? { weekDay: dayIndex + 1 } : {}),
    places: Number(row.places) || 0,
    online: /^s[ií]/i.test(row.online),
  });
}

const schoolName = (id?: string) => [...schools, ...newSchools].find((item) => item.id === id)?.name;
console.log(`Schools to create (${newSchools.length}): ${newSchools.map((item) => item.name).join(", ") || "none"}`);
console.log(`Activities (${upserts.length}, ${upserts.filter((item) => activities.some((current) => current.id === item.id)).length} already imported):`);
for (const item of upserts) {
  console.log(`  ${item.code}  ${item.name.padEnd(30)} → ${schoolName(item.schoolId)}${item.weekDay ? ` · ${WEEK_DAY_NAMES[item.weekDay - 1]}` : ""} · ${item.places} places`);
}

if (!write) console.log("\nDry run: nothing written. Add --write to import.");
else {
  const result = await request<{ activities: number }>("/import", { method: "POST", body: JSON.stringify({ activities: [...newSchools, ...upserts] }) });
  console.log(`\nImported ${result.activities} schools and activities.`);
}
