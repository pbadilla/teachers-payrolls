export interface Teacher {
  id: string;
  code: string;
  name: string;
  type: "coded" | "efectiu";
  hourlyRate: number;
}

export interface MonthlyRecord {
  teacherId: string;
  month: string; // "2026-01", "2026-02", etc.
  hours: number;
}

export const MONTHS_CA = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];
