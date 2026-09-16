import type { Activity, MonthlyRecord, Teacher } from "@/types/teacher";

const request = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) throw new Error((await response.text()) || `API error ${response.status}`);
  return response.status === 204 ? undefined as T : response.json();
};

export const api = {
  getData: () => request<{ teachers: Teacher[]; records: MonthlyRecord[]; activities: Activity[] }>("/data"),
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
  importData: (data: { teachers?: Teacher[]; records?: MonthlyRecord[]; activities?: Activity[] }) =>
    request<{ teachers: number; records: number; activities: number }>("/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
