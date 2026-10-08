/** Incidents of a day: rain, open doors (portes obertes), holiday. Anything else goes in the note. */
export const DAY_INCIDENTS = ["rain", "open-day", "holiday"] as const;
export type DayIncident = (typeof DAY_INCIDENTS)[number];

/** Teachers who did one activity (a school group such as "Sant marti Dimarts") on a day. */
export interface ActivityAssignment {
  activityId: string;
  teacherIds: string[];
}

/**
 * A session of the Calendari that was not done (the teacher was ill, it was cancelled…): it is listed
 * with its reason and doesn't count for pay. The session is the teacher in an activity, or in an Excel
 * row (`row`) when the teacher has no activity that day.
 */
export interface MissedSession {
  teacherId: string;
  activityId?: string;
  row?: "main" | "extra";
  reason: string;
}

/**
 * One day of the attendance calendar. Teachers are listed per activity; `main` and `extra` hold the
 * teachers without an activity (the white and blue rows of the Excel the calendar was loaded from).
 */
export interface CalendarDay {
  main: string[];
  extra: string[];
  note?: string;
  incidents?: DayIncident[];
  assignments?: ActivityAssignment[];
  /** Groups of the club's agenda deleted from this day (they are not shown nor filled). */
  hiddenGroups?: string[];
  /** Sessions of the day marked as not done. */
  missed?: MissedSession[];
  /** @deprecated Saved by an earlier version (activity per teacher); read through normalizeDay. */
  mainActivities?: Record<string, string>;
  /** @deprecated Same, for the blue row. */
  extraActivities?: Record<string, string>;
}

/** A month of the attendance calendar, as in each sheet of the "calendario" Excel. */
export interface CalendarMonth {
  month: string; // "2026-10"
  days: Record<string, CalendarDay>; // keyed by "2026-10-05"
  /** Rate of the month per teacher id, when it differs from the teacher's usual rate. */
  rates?: Record<string, number>;
  /** Amount added to (or taken from) a teacher's pay this month: fixed salaries, advances… */
  adjustments?: Record<string, number>;
  socialSecurity?: number;
  schoolIncome?: number;
  shopIncome?: number;
}

export const emptyDay = (): CalendarDay => ({ main: [], extra: [] });
