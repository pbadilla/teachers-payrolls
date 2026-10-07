export interface Teacher {
  id: string;
  code: string;
  name: string;
  type: "coded" | "efectiu";
  hourlyRate: number;
  rates?: TeacherRate[];
}

export type ActivityKind = "school" | "activity";
export const SCHOOL_SECTIONS = ["schools", "particulars", "casals", "events"] as const;
export type SchoolSection = (typeof SCHOOL_SECTIONS)[number];
export interface Activity {
  id: string;
  name: string;
  kind?: ActivityKind;
  schoolId?: string;
  /** Schools only: teachers who work at the school. */
  teacherIds?: string[];
  /** Schools only: tab of "Activitats / Escoles" the card belongs to (guessed from the name when unset). */
  section?: SchoolSection;
  /** Activities only: code in the registrations system ("ID subcategoria"). */
  code?: string;
  /** Activities only: category in the registrations system ("ESCOLES 26/27"). */
  category?: string;
  /** Activities only: day of the week, 1 = Monday … 7 = Sunday, when the group has one. */
  weekDay?: number;
  /** Activities only: places taken. */
  places?: number;
  /** Activities only: open for online registration. */
  online?: boolean;
}
export interface TeacherRate { activityId: string; hourlyRate: number; }
export interface HoursEntry { activityId: string; hours: number; hourlyRate: number; }

export interface MonthlyRecord {
  teacherId: string;
  month: string; // "2026-01", "2026-02", etc.
  hours: number;
  entries?: HoursEntry[];
  /** Rate of this month when it comes from the calendar and differs from the teacher's rate. */
  hourlyRate?: number;
  /** Amount added to (or taken from) the pay: fixed salaries, advances… */
  adjustment?: number;
}

export interface PayrollMonthState {
  month: string;
  status: "pending" | "paid";
  locked: boolean;
}

export const recordHours = (record?: MonthlyRecord) => record?.entries?.reduce((sum, e) => sum + e.hours, 0) ?? record?.hours ?? 0;
export const recordPayment = (record: MonthlyRecord | undefined, teacher: Teacher) =>
  (record?.entries?.reduce((sum, e) => sum + e.hours * e.hourlyRate, 0) ?? recordHours(record) * (record?.hourlyRate ?? teacher.hourlyRate))
  + (record?.adjustment ?? 0);

export const MONTHS_CA = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];
