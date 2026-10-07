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
