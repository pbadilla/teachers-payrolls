import { normalizeName } from "@/lib/calendar";
import type { Activity, SchoolSection } from "@/types/teacher";

// One accent per school, in alphabetical order: the school cards, the activities of each school and
// the calendar pills share it.
const SCHOOL_ACCENTS = [
  "#e11d48", "#ea580c", "#f59e0b", "#65a30d", "#16a34a", "#0f766e", "#06b6d4", "#0284c7",
  "#2563eb", "#4338ca", "#7c3aed", "#c026d3", "#db2777", "#9f1239", "#92400e", "#475569",
];
export const NO_SCHOOL_COLOR = "#64748b";

export const sortedSchools = (activities: Activity[]) =>
  activities
    .filter((item) => item.kind === "school")
    .sort((left, right) => left.name.localeCompare(right.name, "ca", { sensitivity: "base" }));

export function schoolColors(activities: Activity[]): Map<string, string> {
  return new Map(sortedSchools(activities).map((school, index) => [
    school.id,
    SCHOOL_ACCENTS[index] ?? `hsl(${(index * 137.5) % 360} 70% 45%)`,
  ]));
}

// Activities without a school ("Particulars") get a colour of their own, in alphabetical order.
const OWN_ACTIVITY_ACCENTS = ["#6d28d9", "#be123c", "#15803d", "#b45309", "#0e7490"];

/** Colour of each activity (not school): its school's, or its own when it has no school. */
export function activityColors(activities: Activity[]): Map<string, string> {
  const schools = schoolColors(activities);
  const own = activities.filter((item) => item.kind !== "school" && !item.schoolId).sort((left, right) => left.name.localeCompare(right.name, "ca"));
  return new Map(activities.filter((item) => item.kind !== "school").map((item) => [
    item.id,
    item.schoolId ? schools.get(item.schoolId) ?? NO_SCHOOL_COLOR : OWN_ACTIVITY_ACCENTS[own.indexOf(item) % OWN_ACTIVITY_ACCENTS.length],
  ]));
}

/** "Escola Mare Nostrum" and "Mare Nostrum" are the same school. */
export const schoolKey = (name: string) => normalizeName(name.replace(/^\s*escola\s+/i, ""));

export const WEEK_DAY_NAMES = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];

/** Tabs of "Activitats / Escoles": label, and the placeholder of the form that adds a card there. */
export const SECTION_LABELS: Record<SchoolSection, { label: string; placeholder: string }> = {
  schools: { label: "Escoles", placeholder: "Nova escola" },
  particulars: { label: "Particulares", placeholder: "Nou grup de particulars" },
  casals: { label: "Casals", placeholder: "Nou casal" },
  events: { label: "Events", placeholder: "Nou event" },
};

/** The card's tab: the one saved, or guessed from its name ("Particulares", "Casal d'estiu"…). */
export function sectionOf(school: Activity): SchoolSection {
  if (school.section) return school.section;
  const name = normalizeName(school.name);
  if (name.startsWith("particular")) return "particulars";
  if (name.startsWith("casal")) return "casals";
  if (/^(event|jornad|portesobertes|exhibici)/.test(name)) return "events";
  return "schools";
}
