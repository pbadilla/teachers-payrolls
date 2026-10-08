import type { CalendarDay, CalendarMonth, MissedSession } from "@/types/calendar";
import type { Teacher } from "@/types/teacher";

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const shiftMonth = (month: string, delta: number) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

export const addDays = (dateKey: string, delta: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + delta));
};

/** Weeks (Monday to Sunday) covering the month, as date keys; like the Excel grid. */
export function monthWeeks(month: string): string[][] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(year, monthNumber - 1, 1 - ((first.getDay() + 6) % 7));
  const weeks: string[][] = [];
  for (let cursor = start; ; ) {
    const week = Array.from({ length: 7 }, (_, index) => toDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + index)));
    weeks.push(week);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    if (cursor.getMonth() !== monthNumber - 1) break;
  }
  return weeks;
}

/**
 * The day with every teacher of an activity in `assignments`, converting the activity-per-teacher maps
 * an earlier version saved. Teachers left in `main`/`extra` have no activity.
 */
export function normalizeDay(day: CalendarDay): CalendarDay {
  if (!day.mainActivities && !day.extraActivities) return day;
  const assignments = (day.assignments ?? []).map((assignment) => ({ ...assignment, teacherIds: [...assignment.teacherIds] }));
  const assign = (teacherId: string, activityId: string) => {
    const assignment = assignments.find((item) => item.activityId === activityId);
    if (!assignment) assignments.push({ activityId, teacherIds: [teacherId] });
    else if (!assignment.teacherIds.includes(teacherId)) assignment.teacherIds.push(teacherId);
  };
  const unassigned = (row: string[], activities?: Record<string, string>) =>
    row.filter((teacherId) => {
      const activityId = activities?.[teacherId];
      if (activityId) assign(teacherId, activityId);
      return !activityId;
    });
  const { mainActivities, extraActivities, ...rest } = day;
  return { ...rest, main: unassigned(day.main, mainActivities), extra: unassigned(day.extra, extraActivities), assignments };
}

/**
 * Sessions per teacher: one per activity the teacher did, plus one per Excel row (white or blue) where
 * the teacher appears without an activity, as COUNTIF did in the Excel.
 */
export function countSessions(calendar: Pick<CalendarMonth, "days">): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [date, day] of Object.entries(calendar.days)) {
    for (const session of daySessions(date, day)) {
      if (!session.missed) counts.set(session.teacherId, (counts.get(session.teacherId) ?? 0) + 1);
    }
  }
  return counts;
}

/** One session of the Calendari: a teacher in an activity, or in an Excel row without one. */
export interface CalendarSession {
  date: string;
  teacherId: string;
  activityId?: string;
  row?: "main" | "extra";
  /** Set when the session was marked as not done. */
  missed?: MissedSession;
}

/** Whether a "not done" mark is about this session (same teacher and same activity or row). */
export const isSameSession = (mark: Pick<MissedSession, "teacherId" | "activityId" | "row">, session: Pick<CalendarSession, "teacherId" | "activityId" | "row">) =>
  mark.teacherId === session.teacherId && (session.activityId ? mark.activityId === session.activityId : !mark.activityId && mark.row === session.row);

/** The sessions of a day, as countSessions counts them (a teacher once per row and per activity). */
export function daySessions(date: string, raw: CalendarDay): CalendarSession[] {
  const day = normalizeDay(raw);
  const sessions: CalendarSession[] = [
    ...[...new Set(day.main)].map((teacherId) => ({ date, teacherId, row: "main" as const })),
    ...[...new Set(day.extra)].map((teacherId) => ({ date, teacherId, row: "extra" as const })),
    ...(day.assignments ?? []).flatMap((assignment) => [...new Set(assignment.teacherIds)].map((teacherId) => ({ date, teacherId, activityId: assignment.activityId }))),
  ];
  return sessions.map((session) => {
    const missed = day.missed?.find((mark) => isSameSession(mark, session));
    return missed ? { ...session, missed } : session;
  });
}

/** A teacher's sessions of the month, done or not, by date. */
export function teacherSessions(calendar: Pick<CalendarMonth, "days">, teacherId: string) {
  return Object.entries(calendar.days)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([date, day]) => daySessions(date, day).filter((session) => session.teacherId === teacherId));
}

/** Catalan weekday abbreviations, Sunday first as Date.getDay(). */
const WEEK_DAYS_SHORT = ["DG", "DL", "DT", "DC", "DJ", "DV", "DS"];
const MONTHS_SHORT = ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Des"];
/** "2026-09-14" → "DL/14/Set". */
export const shortDayLabel = (date: string) =>
  `${WEEK_DAYS_SHORT[new Date(`${date}T12:00:00`).getDay()]}/${Number(date.slice(8))}/${MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}`;

export const isEmptyDay = (day?: CalendarDay) =>
  !day || (!day.main.length && !day.extra.length && !day.note && !day.incidents?.length && !day.assignments?.some((item) => item.teacherIds.length) && !day.hiddenGroups?.length
    && !Object.keys(day.mainActivities ?? {}).length && !Object.keys(day.extraActivities ?? {}).length);

// ---- Matching the names typed in the Excel to teachers ----

/** "Raúl" → "raul", "Laura M." → "lauram": accents, case and punctuation are ignored. */
export const normalizeName = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const CONNECTORS = new Set(["i", "y", "e"]);

/** Splits a calendar cell ("bernat i mario", " Alex Nuria") into name tokens. */
export const cellTokens = (text: string) =>
  text.split(/[\s,;/+&]+/).filter((token) => normalizeName(token) && !CONNECTORS.has(normalizeName(token)));

export interface NameCandidate {
  key: string;
  name: string;
  aliases?: string[];
}

/**
 * Finds the teacher a token refers to: same name or first name, then a known alias
 * (the pattern of the Excel's COUNTIF), then an unambiguous prefix ("Mati" → "Matias").
 */
export function matchName(token: string, candidates: NameCandidate[]): NameCandidate | undefined {
  const value = normalizeName(token);
  if (!value) return undefined;
  const unique = (matches: NameCandidate[]) => (matches.length === 1 ? matches[0] : undefined);
  const firstWord = (name: string) => normalizeName(name.split(/[\s(]/).find(Boolean) ?? name);

  const exact = candidates.filter((candidate) => normalizeName(candidate.name) === value);
  if (exact.length) return exact[0];
  const byFirstName = unique(candidates.filter((candidate) => firstWord(candidate.name) === value));
  if (byFirstName) return byFirstName;
  const byAlias = unique(candidates.filter((candidate) => candidate.aliases?.some((alias) => normalizeName(alias) === value)));
  if (byAlias) return byAlias;
  if (value.length < 4) return undefined;
  return unique(candidates.filter((candidate) => normalizeName(candidate.name).startsWith(value)));
}

export interface CalendarPayrollRow {
  teacher: Teacher;
  sessions: number;
  rate: number;
  adjustment: number;
  pay: number;
}

/** The "Profes" table of the Excel: sessions × rate of the month, plus any adjustment. */
export function calendarPayroll(calendar: CalendarMonth, teachers: Teacher[]): CalendarPayrollRow[] {
  const sessions = countSessions(calendar);
  return teachers
    .map((teacher) => {
      const count = sessions.get(teacher.id) ?? 0;
      const rate = calendar.rates?.[teacher.id] ?? teacher.hourlyRate;
      const adjustment = calendar.adjustments?.[teacher.id] ?? 0;
      return { teacher, sessions: count, rate, adjustment, pay: count * rate + adjustment };
    })
    .filter((row) => row.sessions > 0 || row.adjustment !== 0 || calendar.rates?.[row.teacher.id] !== undefined)
    .sort((left, right) => left.teacher.name.localeCompare(right.teacher.name, "ca"));
}
