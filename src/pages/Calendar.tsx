import { type CSSProperties, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Copy, Palette, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { type DayActivity, DayEditor } from "@/components/calendar/DayEditor";
import { INCIDENT_STYLES } from "@/components/calendar/incidents";
import { MonthSelector } from "@/components/MonthSelector";
import { agendaApi, type AgendaGroup } from "@/lib/agenda-api";
import { api } from "@/lib/api";
import { addDays, isEmptyDay, monthWeeks, normalizeDay, normalizeName, shiftMonth } from "@/lib/calendar";
import { NO_SCHOOL_COLOR, schoolColors, schoolKey, sectionOf, sortedSchools } from "@/lib/school-colors";
import { type CalendarDay, type CalendarMonth, DAY_INCIDENTS, emptyDay } from "@/types/calendar";
import { MONTHS_CA } from "@/types/teacher";

// Pills, agenda lines and legend take the colour of the school (the same as its card).
const OWN_ACTIVITY_ACCENTS = ["#6d28d9", "#be123c", "#15803d", "#b45309", "#0e7490"];
const accentStyle = (color: string) => ({ "--activity-accent": color }) as CSSProperties;

const WEEKEND_KEY = "payrolls.calendar.weekend";
/** First day with data in the app; the club keeps nothing older. */
const DATA_START = "2026-09-01";
/** School-year days: from DATA_START on, July and August excluded. */
/** Private lessons: "Particulars" here, "Particulares Adult@s" in the club app. */
const isParticular = (name: string) => /^\s*particular/i.test(name);
const agendaApplies = (date: string) => date >= DATA_START && !["07", "08"].includes(date.slice(5, 7));
const WEEK_DAYS = ["Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte", "Diumenge"];
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (month: string) => `${MONTHS_CA[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const dayTitle = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Day of the week of a date key, 1 = Monday … 7 = Sunday (as the agenda's schedule). */
const weekDay = (date: string) => ((new Date(`${date}T12:00:00`).getDay() + 6) % 7) + 1;

/**
 * Attendance calendar (the "calendario" Excel) joined with the weekly agenda of the club app: each day
 * shows who worked (main and blue rows, note) and, below, the agenda groups scheduled that weekday.
 * The month's payroll comes from who worked. Days of the previous or next month shown in the grid
 * count here when they are filled here.
 */
export default function Calendar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("month");
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonth;
  const setMonth = (next: string) => setSearchParams({ month: next });
  const queryClient = useQueryClient();
  const [editingDate, setEditingDate] = useState<string | null>(null);
  // Which cards each day shows: everything, only the schools' activities or only private lessons.
  const [kindFilter, setKindFilter] = useState<"all" | "schools" | "particulars">("all");
  // Saturday and Sunday can be hidden; the choice is remembered in this browser.
  const [showWeekend, setShowWeekend] = useState(() => {
    try { return localStorage.getItem(WEEKEND_KEY) !== "hidden"; } catch { return true; }
  });
  const changeShowWeekend = (show: boolean) => {
    setShowWeekend(show);
    try { localStorage.setItem(WEEKEND_KEY, show ? "shown" : "hidden"); } catch { /* Not remembered: still applies now. */ }
  };
  const visibleDays = showWeekend ? 7 : 5;
  const gridColumns = showWeekend ? "grid-cols-7" : "grid-cols-5";

  const payrollData = useQuery({ queryKey: ["payroll-data"], queryFn: api.getData });
  const calendar = useQuery({ queryKey: ["calendar", month], queryFn: () => api.getCalendar(month) });
  const previous = useQuery({ queryKey: ["calendar", shiftMonth(month, -1)], queryFn: () => api.getCalendar(shiftMonth(month, -1)) });
  const next = useQuery({ queryKey: ["calendar", shiftMonth(month, 1)], queryFn: () => api.getCalendar(shiftMonth(month, 1)) });
  // The agenda lives in the club app (new-playoff); the calendar still works when it is not reachable.
  const agendaGroups = useQuery({ queryKey: ["agenda", "groups"], queryFn: agendaApi.groups, retry: 1 });
  const agendaSchools = useQuery({ queryKey: ["agenda", "schools"], queryFn: agendaApi.schools, retry: 1 });

  const teachers = [...(payrollData.data?.teachers ?? [])].sort((left, right) => left.name.localeCompare(right.name, "ca"));
  const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  // Days saved by an earlier version are converted, so saving the month keeps their activities.
  const loaded: CalendarMonth = calendar.data ?? { month, days: {} };
  const current: CalendarMonth = { ...loaded, days: Object.fromEntries(Object.entries(loaded.days).map(([date, day]) => [date, normalizeDay(day)])) };

  const save = useMutation({
    mutationFn: api.saveCalendar,
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: ["calendar", updated.month] });
      const before = queryClient.getQueryData<CalendarMonth>(["calendar", updated.month]);
      queryClient.setQueryData(["calendar", updated.month], updated);
      return { before };
    },
    onError: (error, updated, context) => {
      queryClient.setQueryData(["calendar", updated.month], context?.before);
      toast.error(error instanceof Error ? error.message : "No s'ha pogut desar el calendari");
    },
  });


  /** The day as this month sees it: its own data, or read-only data counted in the neighbouring month. */
  const dayView = (date: string): { day?: CalendarDay; countedIn?: string } => {
    if (!isEmptyDay(current.days[date])) return { day: current.days[date] };
    for (const neighbour of [previous.data, next.data]) {
      if (neighbour && !isEmptyDay(neighbour.days[date])) return { day: normalizeDay(neighbour.days[date]), countedIn: neighbour.month };
    }
    return {};
  };

  const updateDay = (date: string, day: CalendarDay) => {
    const days = { ...current.days };
    if (isEmptyDay(day)) delete days[date];
    else days[date] = day;
    save.mutate({ ...current, days });
  };

  const copyPreviousWeek = (week: string[]) => {
    const targets = week.filter((date) => !dayView(date).countedIn);
    const overwrites = targets.some((date) => !isEmptyDay(current.days[date]));
    if (overwrites && !window.confirm("Aquesta setmana ja té dies omplerts. Vols substituir-los per la setmana anterior?")) return;
    const days = { ...current.days };
    for (const date of targets) {
      const source = dayView(addDays(date, -7)).day;
      // Only who worked is copied: notes such as "Festiu" belong to their own day.
      if (source && (source.main.length || source.extra.length || source.assignments?.length)) {
        days[date] = { main: source.main, extra: source.extra, ...(source.assignments?.length ? { assignments: source.assignments } : {}) };
      }
      else delete days[date];
    }
    save.mutate({ ...current, days });
  };


  // The agenda is a weekly timetable without dates: it only applies during the school year (from
  // September 2026, not in July and August) and not on holidays.
  const agendaFor = (date: string) =>
    !agendaApplies(date) || current.days[date]?.incidents?.includes("holiday") ? [] : (agendaGroups.data ?? [])
      .flatMap((group) => group.schedule.filter((slot) => slot.dayOfWeek === weekDay(date)).map((slot) => ({ group, slot })))
      .sort((left, right) => left.slot.startsAt.localeCompare(right.slot.startsAt));
  const schoolName = (group: AgendaGroup) =>
    agendaSchools.data?.find((school) => school.id === group.schoolId)?.name ?? (group.scope === "school" ? "Centre sense assignar" : "Grup extern");

  // The schools and their activities (groups such as "Sant marti Dimarts") of this app. Activities
  // without a school, such as "Particulars", get a colour of their own.
  const payrollActivities = payrollData.data?.activities ?? [];
  const colors = schoolColors(payrollActivities);
  const schools = sortedSchools(payrollActivities);
  const ownActivities = payrollActivities.filter((item) => item.kind !== "school" && !item.schoolId).sort((left, right) => left.name.localeCompare(right.name, "ca"));
  const ownColor = (id: string) => OWN_ACTIVITY_ACCENTS[ownActivities.findIndex((item) => item.id === id) % OWN_ACTIVITY_ACCENTS.length] ?? NO_SCHOOL_COLOR;
  const dayActivities: DayActivity[] = payrollActivities
    .filter((item) => item.kind !== "school")
    .sort((left, right) => left.name.localeCompare(right.name, "ca"))
    .map((item) => ({ id: item.id, name: item.name, color: item.schoolId ? colors.get(item.schoolId) ?? NO_SCHOOL_COLOR : ownColor(item.id), schoolId: item.schoolId, weekDay: item.weekDay, places: item.places }));
  /** The agenda's school (club app) is matched to the school of this app by name. */
  // Private lessons live in the school "Particulares" (activities "Adult@s Lunes", "Particulars"…).
  // Any card in the "Particulares" tab of Activitats / Escoles counts.
  const particularSchoolIds = new Set(schools.filter((school) => sectionOf(school) === "particulars").map((school) => school.id));
  const particularsSchoolId = schools.find((school) => particularSchoolIds.has(school.id) && isParticular(school.name))?.id ?? [...particularSchoolIds][0];
  const activityIsParticular = (activity?: DayActivity) =>
    Boolean(activity && (isParticular(activity.name) || (activity.schoolId && particularSchoolIds.has(activity.schoolId))));
  /**
   * The agenda's school (club app) is matched to the school of this app by name; its private-lesson
   * groups ("Particulares Adult@s", without a school) go to the school "Particulares".
   */
  const agendaSchoolId = (group: AgendaGroup) =>
    schools.find((school) => schoolKey(school.name) === schoolKey(schoolName(group)))?.id
    ?? (isParticular(group.activityName ?? group.name) ? particularsSchoolId : undefined);
  /** Groups without a school ("Particulares Adult@s") are matched to an activity without a school ("Particulars"). */
  const agendaOwnActivity = (group: AgendaGroup) => agendaSchoolId(group) ? undefined : ownActivities.find((item) =>
    normalizeName(group.activityName ?? group.name).startsWith(normalizeName(item.name).replace(/s$/, "")));
  const activityColor = (group: AgendaGroup) => {
    const own = agendaOwnActivity(group);
    return own ? ownColor(own.id) : colors.get(agendaSchoolId(group) ?? "") ?? NO_SCHOOL_COLOR;
  };
  // Legend: the schools and activities without a school that appear this month, in the day or in the agenda.
  const usedActivities = Object.values(current.days).flatMap((day) => day.assignments ?? [])
    .map((assignment) => dayActivities.find((item) => item.id === assignment.activityId));
  const legendIds = new Set([
    ...usedActivities.map((activity) => activity?.schoolId ?? activity?.id),
    ...(agendaApplies(`${month}-01`) ? (agendaGroups.data ?? []).map((group) => agendaSchoolId(group) ?? agendaOwnActivity(group)?.id) : []),
  ].filter((id): id is string => Boolean(id)));
  const legendSchools = [
    ...schools.map((school) => ({ id: school.id, name: school.name, color: colors.get(school.id) ?? NO_SCHOOL_COLOR })),
    ...ownActivities.map((activity) => ({ id: activity.id, name: activity.name, color: ownColor(activity.id) })),
  ].filter((item) => legendIds.has(item.id));

  /**
   * One card per activity of the day, in its colour: name, its teachers and, for the agenda's groups,
   * the time and participants. The agenda's groups get the teachers assigned to an activity of the same
   * school; assigned activities the agenda doesn't have follow. Excel teachers without an activity are
   * not shown (they are in the day editor).
   */
  const dayRows = (date: string, day: CalendarDay | undefined, outside: boolean) => {
    const assignments = day?.assignments ?? [];
    const used = new Set<string>();
    const rows: { key: string; time?: string; endsAt?: string; label: string; color: string; participants?: number; teacherIds: string[]; particular: boolean }[] = [];

    for (const { group, slot } of outside ? [] : agendaFor(date)) {
      const schoolId = agendaSchoolId(group);
      const own = agendaOwnActivity(group);
      const matching = assignments.filter((assignment) => assignment.activityId === own?.id
        || (schoolId && dayActivities.find((item) => item.id === assignment.activityId)?.schoolId === schoolId));
      matching.forEach((assignment) => used.add(assignment.activityId));
      rows.push({
        key: `${group.id}-${slot.startsAt}`,
        time: slot.startsAt,
        endsAt: slot.endsAt,
        label: own ? group.activityName ?? own.name : schoolName(group),
        color: activityColor(group),
        participants: group.participantCount,
        teacherIds: [...new Set(matching.flatMap((assignment) => assignment.teacherIds))],
        particular: isParticular(group.activityName ?? group.name),
      });
    }
    for (const assignment of assignments.filter((item) => !used.has(item.activityId))) {
      const activity = dayActivities.find((item) => item.id === assignment.activityId);
      rows.push({ key: assignment.activityId, label: activity?.name ?? "Activitat eliminada", color: activity?.color ?? NO_SCHOOL_COLOR, teacherIds: assignment.teacherIds, particular: activityIsParticular(activity) });
    }
    rows.sort((left, right) => (left.time ?? "99").localeCompare(right.time ?? "99"));
    const visible = rows.filter((row) => kindFilter === "all" || (kindFilter === "particulars") === row.particular);

    if (!visible.length) return <span className="flex-1" />;
    return (
      <span className="flex flex-1 flex-col gap-1.5 px-1.5 py-1.5">
        {visible.map((row) => {
          const names = row.teacherIds.map((id) => teacherNames.get(id) ?? "?").join(", ");
          return (
            <span key={row.key} className="day-activity-card block border border-l-[3px] px-2 py-1.5" style={accentStyle(row.color)}>
              <span className="block truncate text-[11px] font-bold leading-tight text-slate-800">{row.label}</span>
              <span className={`block truncate text-[10px] leading-snug ${names ? "text-slate-600" : "italic text-slate-400"}`} title={names || undefined}>
                {names || "Sense professor"}
              </span>
              {(row.time || row.participants !== undefined) && (
                <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-600">
                  {row.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{row.time}{row.endsAt && `–${row.endsAt}`}</span>}
                  {row.participants !== undefined && <span className="flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" />{row.participants}</span>}
                </span>
              )}
            </span>
          );
        })}
      </span>
    );
  };
  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-4">
          <h1 className="sr-only">Calendari</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="flex h-10 w-10 items-center justify-center border border-slate-300 hover:bg-slate-50" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
            <MonthSelector selectedMonth={month} onChange={setMonth} />
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className="flex h-10 w-10 items-center justify-center border border-slate-300 hover:bg-slate-50" aria-label="Mes següent"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger className="flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Palette className="h-4 w-4" /> Llegenda
                {legendSchools.length > 0 && (
                  <span className="flex -space-x-1" aria-hidden="true">
                    {legendSchools.slice(0, 5).map((item) => <span key={item.id} className="activity-swatch h-3 w-3 rounded-full ring-2 ring-white" style={accentStyle(item.color)} />)}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 space-y-4 p-4">
                <section className="space-y-2">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Escoles i activitats · {monthLabel(month)}</h2>
                  {legendSchools.length ? (
                    <ul className="grid max-h-72 gap-1.5 overflow-y-auto">
                      {legendSchools.map((item) => (
                        <li key={item.id} className="day-activity-card flex items-center gap-2 border border-l-[3px] px-2 py-1 text-xs font-semibold text-slate-800" style={accentStyle(item.color)}>
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-slate-400">Cap activitat aquest mes.</p>}
                </section>
                <section className="space-y-2 border-t border-slate-100 pt-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Incidències</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_INCIDENTS.map((incident) => {
                      const { label, icon: Icon, className } = INCIDENT_STYLES[incident];
                      return <span key={incident} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}><Icon className="h-3 w-3" aria-hidden="true" /> {label}</span>;
                    })}
                  </div>
                </section>
              </PopoverContent>
            </Popover>
            <div role="radiogroup" aria-label="Mostrar" className="flex h-10 border border-slate-300">
              {([["all", "Tot"], ["schools", "Escoles"], ["particulars", "Particulars"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kindFilter === value}
                  onClick={() => setKindFilter(value)}
                  className={`px-3 text-sm font-semibold transition ${kindFilter === value ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={showWeekend} onChange={(event) => changeShowWeekend(event.target.checked)} /> Cap de setmana
            </label>
          </div>
        </header>

        {agendaGroups.isError && (
          <div className="border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">No s'ha pogut carregar l'agenda del club. El calendari funciona igualment.</div>
        )}
        {calendar.isLoading || payrollData.isLoading ? (
          <div className="border border-slate-200 bg-white p-12 text-center text-muted-foreground">Carregant calendari…</div>
        ) : calendar.error || payrollData.error ? (
          <div className="border border-red-200 bg-red-50 p-5 text-red-700">No s'ha pogut carregar el calendari.</div>
        ) : (
          <>
            <section className="overflow-x-auto border border-slate-200 bg-white">
              <div className={showWeekend ? "min-w-[980px]" : "min-w-[720px]"}>
                <div className={`grid ${gridColumns} border-b border-slate-200 bg-slate-50`}>
                  {WEEK_DAYS.slice(0, visibleDays).map((label) => <div key={label} className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-violet-700">{label}</div>)}
                </div>
                {monthWeeks(month).map((week, index) => (
                  <div key={week[0]} className="border-b border-slate-200 last:border-b-0">
                    <div className="flex items-center justify-end bg-slate-50/60 px-2 py-0.5">
                      <button type="button" onClick={() => copyPreviousWeek(week)} className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-violet-50 hover:text-violet-700" aria-label={`Copiar la setmana anterior a la setmana ${index + 1}`}>
                        <Copy className="h-3 w-3" /> Copiar setmana anterior
                      </button>
                    </div>
                    <div className={`grid ${gridColumns} divide-x divide-slate-200`}>
                      {week.slice(0, visibleDays).map((date) => {
                        const { day, countedIn } = dayView(date);
                        const outside = !date.startsWith(month);
                        const dayNumber = Number(date.slice(8));
                        return (
                          <button
                            key={date}
                            type="button"
                            disabled={Boolean(countedIn)}
                            onClick={() => setEditingDate(date)}
                            title={countedIn ? `Comptat a ${monthLabel(countedIn)}` : undefined}
                            className={`flex min-h-[132px] flex-col text-left transition ${countedIn ? "cursor-not-allowed bg-slate-50 opacity-50" : "hover:bg-violet-50/40"} ${outside && !day ? "bg-slate-50/70" : ""} ${day?.incidents?.includes("holiday") ? "bg-amber-50/70" : ""}`}
                          >
                            <span className="flex items-start justify-between gap-1 px-2 pt-1.5">
                              <span className={`text-xs font-bold ${outside ? "text-slate-400" : "text-slate-700"}`}>
                                {dayNumber}{outside && ` ${MONTHS_CA[Number(date.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}.`}
                                {countedIn && <span className="ml-1 font-normal">· {MONTHS_CA[Number(countedIn.slice(5)) - 1].toLowerCase()}</span>}
                              </span>
                              {day?.incidents?.length ? (
                                <span className="flex flex-wrap justify-end gap-1">
                                  {day.incidents.map((incident) => {
                                    const { label, icon: Icon, className } = INCIDENT_STYLES[incident];
                                    return (
                                      <span key={incident} title={label} className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-semibold ${className}`}>
                                        <Icon className="h-3 w-3" aria-hidden="true" /> {label}
                                      </span>
                                    );
                                  })}
                                </span>
                              ) : null}
                            </span>
                            {dayRows(date, day, outside)}
                            {day?.note && <span className="px-2 pb-1.5 pt-1 text-[11px] italic text-amber-700">{day.note}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </>
        )}
      </div>

      {editingDate && (
        <DayEditor
          title={dayTitle(editingDate)}
          day={current.days[editingDate] ?? emptyDay()}
          teachers={teachers}
          activities={dayActivities}
          weekDay={weekDay(editingDate)}
          onClose={() => setEditingDate(null)}
          onSave={(day) => { updateDay(editingDate, day); setEditingDate(null); }}
        />
      )}
    </div>
  );
}
