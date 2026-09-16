import type { Activity, MonthlyRecord, PayrollMonthState, Teacher } from "@/types/teacher";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const headers = new Headers(options?.headers);
  if (options?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const responseText = await response.text();
    try {
      const parsed = JSON.parse(responseText) as { error?: string; message?: string };
      throw new Error(parsed.error ?? parsed.message ?? `API error ${response.status}`);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(responseText || `API error ${response.status}`);
      throw error;
    }
  }
  return response.status === 204 ? undefined as T : response.json();
};

export const api = {
  getData: () => request<{ teachers: Teacher[]; records: MonthlyRecord[]; activities: Activity[]; payrollMonths: PayrollMonthState[] }>("/data"),
  seed: (teachers: Teacher[], records: MonthlyRecord[]) =>
    request<void>("/seed", { method: "POST", body: JSON.stringify({ teachers, records }) }),
  addTeacher: (teacher: Teacher) =>
    request<Teacher>("/teachers", { method: "POST", body: JSON.stringify(teacher) }),
  updateTeacher: (teacher: Teacher) =>
    request<Teacher>(`/teachers/${teacher.id}`, { method: "PUT", body: JSON.stringify(teacher) }),
  deleteTeacher: (id: string) => request<void>(`/teachers/${id}`, { method: "DELETE" }),
  addActivity: (activity: Activity) => request<Activity>("/activities", { method: "POST", body: JSON.stringify(activity) }),
  deleteActivity: (id: string) => request<void>(`/activities/${id}`, { method: "DELETE" }),
  updateRecord: (record: MonthlyRecord) =>
    request<MonthlyRecord>(`/records/${record.teacherId}/${record.month}`, {
      method: "PUT",
      body: JSON.stringify({ hours: record.hours, entries: record.entries }),
    }),
  updatePayrollMonth: (state: PayrollMonthState) =>
    request<PayrollMonthState>(`/payroll-months/${state.month}`, {
      method: "PUT",
      body: JSON.stringify({ status: state.status, locked: state.locked }),
    }),
  copyPayrollMonth: (sourceMonth: string, targetMonth: string, overwrite = false) =>
    request<{ copied: number }>("/payroll-months/copy", {
      method: "POST",
      body: JSON.stringify({ sourceMonth, targetMonth, overwrite }),
    }),
  importData: (data: { teachers?: Teacher[]; records?: MonthlyRecord[]; activities?: Activity[] }) =>
    request<{ teachers: number; records: number; activities: number }>("/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
