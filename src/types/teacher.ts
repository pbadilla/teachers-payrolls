export interface Teacher {
  id: string;
  code: string;
  name: string;
  type: "coded" | "efectiu";
  hourlyRate: number;
  rates?: TeacherRate[];
}

export interface Activity { id: string; name: string; }
export interface TeacherRate { activityId: string; hourlyRate: number; }
export interface HoursEntry { activityId: string; hours: number; hourlyRate: number; }

export interface MonthlyRecord {
  teacherId: string;
  month: string; // "2026-01", "2026-02", etc.
  hours: number;
  entries?: HoursEntry[];
}

export const recordHours = (record?: MonthlyRecord) => record?.entries?.reduce((sum, e) => sum + e.hours, 0) ?? record?.hours ?? 0;
export const recordPayment = (record: MonthlyRecord | undefined, teacher: Teacher) =>
  record?.entries?.reduce((sum, e) => sum + e.hours * e.hourlyRate, 0) ?? recordHours(record) * teacher.hourlyRate;

export const MONTHS_CA = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];
