// Read-only client for the RG360 club API (new-playoff), which owns the weekly agenda shown in the
// Calendari grid (activity groups and schools). Edits are made in that app, not here.
const PLAYOFF_API_URL = import.meta.env.VITE_PLAYOFF_API_URL ?? "http://localhost:3001";
const ORGANIZATION_ID = import.meta.env.VITE_ORGANIZATION_ID ?? "20000000-0000-4000-8000-000000000001";

export interface AgendaSchool { id: string; name: string; }

export interface AgendaGroup {
  id: string;
  activityId: string;
  activityName?: string;
  name: string;
  schedule: { dayOfWeek: number; startsAt: string; endsAt: string }[];
  teacherIds: string[];
  scope: "school" | "external";
  schoolId: string | null;
  participantCount: number;
}

const request = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${PLAYOFF_API_URL}/organizations/${ORGANIZATION_ID}${path}`);
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return response.json();
};

const listActive = <T>(resource: string) =>
  request<{ items: T[] }>(`/${resource}?active=true&pageSize=100`).then((page) => page.items);

export const agendaApi = {
  groups: () => request<AgendaGroup[]>("/activity-groups"),
  schools: () => listActive<AgendaSchool>("schools"),
};
