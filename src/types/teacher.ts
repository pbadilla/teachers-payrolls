export interface Teacher {
  id: string;
  code: string;
  name: string;
  type: "coded" | "efectiu";
  monthlyHours: number[];
  totalOwed: number;
}

export interface HourEntry {
  id: string;
  teacherId: string;
  date: string;
  hours: number;
  category: string;
  note?: string;
}
