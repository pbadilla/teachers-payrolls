import { type CSSProperties, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Copy, ListChecks, Palette, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ActivityEditor } from "@/components/calendar/ActivityEditor";
import { type DayActivity, DayEditor } from "@/components/calendar/DayEditor";
import { INCIDENT_STYLES } from "@/components/calendar/incidents";
import { MonthSelector } from "@/components/MonthSelector";
import { agendaApi, type AgendaGroup } from "@/lib/agenda-api";
import { api } from "@/lib/api";
import { addDays, isEmptyDay, monthWeeks, normalizeDay, normalizeName, shiftMonth } from "@/lib/calendar";
import { activityColors, NO_SCHOOL_COLOR, schoolColors, schoolKey, sectionOf, sortedSchools } from "@/lib/school-colors";
import { type CalendarDay, type CalendarMonth, DAY_INCIDENTS, emptyDay } from "@/types/calendar";
import { MONTHS_CA } from "@/types/teacher";

// Pills, agenda lines and legend take the colour of the school (the same as its card).
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

/** A card picked to be deleted: the day, the assignments it shows and its agenda group. */
interface SelectedCard { date: string; replaces: string[]; groupId?: string; }

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
  const queryClient = useQueryClient();
  const [editingDate, setEditingDate] = useState<string | null>(null);
  // One card of a day: `activityId` is the activity it saves to (none for a new card), `replaces` the
  // assignments the card shows (an agenda group may gather several activities of its school) and
  // `groupId` the agenda group it comes from.
  const [editingActivity, setEditingActivity] = useState<{ date: string; activityId?: string; replaces: string[]; teacherIds: string[]; groupId?: string; existing: boolean } | null>(null);
  // Selecting cards to delete several at once, keyed by `${date}|${card key}`.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Record<string, SelectedCard>>({});
  const stopSelecting = () => { setSelecting(false); setSelected({}); };
  // The selection belongs to the month shown.
  const setMonth = (next: string) => { setSelected({}); setSearchParams({ month: next }); };
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
    // Shows what the server really kept, not only what was sent.
    onSettled: (_data, _error, updated) => queryClient.invalidateQueries({ queryKey: ["calendar", updated.month] }),
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

  /** Saves one card: its teachers go to `activityId`; teachers of the Excel rows given an activity move to it. */
  const saveActivity = (date: string, replaces: string[], activityId: string, teacherIds: string[]) => {
    const day = current.days[date] ?? emptyDay();
    const assignments = [
      ...(day.assignments ?? []).filter((item) => item.activityId !== activityId && !replaces.includes(item.activityId)),
      ...(teacherIds.length ? [{ activityId, teacherIds }] : []),
    ];
    const { assignments: _previous, ...rest } = day;
    updateDay(date, {
      ...rest,
      main: day.main.filter((id) => !teacherIds.includes(id)),
      extra: day.extra.filter((id) => !teacherIds.includes(id)),
      ...(assignments.length ? { assignments } : {}),
    });
  };

  /**
   * Deletes cards from their days, in one save: their teachers, and the agenda groups (hidden those
   * days) they come from.
   */
  const deleteCards = (cards: SelectedCard[]) => {
    const days = { ...current.days };
    for (const date of new Set(cards.map((card) => card.date))) {
      const ofDay = cards.filter((card) => card.date === date);
      const day = days[date] ?? emptyDay();
      const { assignments: _assignments, hiddenGroups: _hidden, ...rest } = day;
      const assignments = (day.assignments ?? []).filter((item) => !ofDay.some((card) => card.replaces.includes(item.activityId)));
      const hiddenGroups = [...new Set([...(day.hiddenGroups ?? []), ...ofDay.flatMap((card) => (card.groupId ? [card.groupId] : []))])];
      const updated = { ...rest, ...(assignments.length ? { assignments } : {}), ...(hiddenGroups.length ? { hiddenGroups } : {}) };
      if (isEmptyDay(updated)) delete days[date];
      else days[date] = updated;
    }
    save.mutate({ ...current, days });
  };
  const deleteActivity = (date: string, replaces: string[], groupId?: string) => deleteCards([{ date, replaces, groupId }]);

  /**
   * Copies who worked the previous week (teachers, activities and the agenda groups deleted) onto the
   * days shown of this week. Each day keeps its own note and incidents; empty or holiday days of the
   * previous week leave their day as it is, and holidays are not filled.
   */
  const copyPreviousWeek = (week: string[]) => {
    const worked = (day?: CalendarDay) => Boolean(day && (day.main.length || day.extra.length || day.assignments?.length));
    const copies = week.slice(0, visibleDays).flatMap((date) => {
      const target = current.days[date];
      const source = dayView(addDays(date, -7)).day;
      if (dayView(date).countedIn || target?.incidents?.includes("holiday") || !source || source.incidents?.includes("holiday") || !worked(source)) return [];
      return [{ date, source, target }];
    });
    if (!copies.length) {
      toast.info("La setmana anterior no té dies amb professors per copiar.");
      return;
    }
    if (copies.some(({ target }) => worked(target)) && !window.confirm("Alguns dies d'aquesta setmana ja tenen professors. Vols substituir-los pels de la setmana anterior?")) return;
    const days = { ...current.days };
    for (const { date, source, target } of copies) {
      // The day's "not done" marks are about the sessions being replaced: they go too.
      const { main: _main, extra: _extra, assignments: _assignments, hiddenGroups: _hidden, missed: _missed, ...kept } = target ?? emptyDay();
      days[date] = {
        ...kept,
        main: source.main,
        extra: source.extra,
        ...(source.assignments?.length ? { assignments: source.assignments } : {}),
        ...(source.hiddenGroups?.length ? { hiddenGroups: source.hiddenGroups } : {}),
      };
    }
    save.mutate({ ...current, days }, { onSuccess: () => toast.success(`${copies.length} dies copiats de la setmana anterior`) });
  };


  // The agenda is a weekly timetable without dates: it only applies during the school year (from
  // September 2026, not in July and August) and not on holidays. Groups deleted from a day are left out.
  const agendaFor = (date: string) =>
    !agendaApplies(date) || current.days[date]?.incidents?.includes("holiday") ? [] : (agendaGroups.data ?? [])
      .filter((group) => !current.days[date]?.hiddenGroups?.includes(group.id))
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
  const colorOfActivity = activityColors(payrollActivities);
  const ownColor = (id: string) => colorOfActivity.get(id) ?? NO_SCHOOL_COLOR;
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
  /** The activity an agenda card saves its teachers to: its own activity, or its school's for that weekday. */
  const agendaActivityId = (group: AgendaGroup, date: string) => {
    const own = agendaOwnActivity(group);
    if (own) return own.id;
    const candidates = dayActivities.filter((item) => item.schoolId && item.schoolId === agendaSchoolId(group));
    return (candidates.find((item) => item.weekDay === weekDay(date)) ?? candidates.find((item) => !item.weekDay) ?? candidates[0])?.id;
  };
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
   * not shown (they are in the day editor). Each card opens its own editor; the dashed area below adds one.
   */
  const cardRows = (date: string, day: CalendarDay | undefined, outside: boolean) => {
    const assignments = day?.assignments ?? [];
    const used = new Set<string>();
    const rows: { key: string; time?: string; endsAt?: string; label: string; color: string; participants?: number; teacherIds: string[]; particular: boolean; activityId?: string; replaces: string[]; groupId?: string }[] = [];

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
        activityId: matching[0]?.activityId ?? agendaActivityId(group, date),
        replaces: matching.map((assignment) => assignment.activityId),
        groupId: group.id,
      });
    }
    for (const assignment of assignments.filter((item) => !used.has(item.activityId))) {
      const activity = dayActivities.find((item) => item.id === assignment.activityId);
      rows.push({ key: assignment.activityId, label: activity?.name ?? "Activitat eliminada", color: activity?.color ?? NO_SCHOOL_COLOR, teacherIds: assignment.teacherIds, particular: activityIsParticular(activity), activityId: assignment.activityId, replaces: [assignment.activityId] });
    }
    rows.sort((left, right) => (left.time ?? "99").localeCompare(right.time ?? "99"));
    return rows.filter((row) => kindFilter === "all" || (kindFilter === "particulars") === row.particular);
  };

  /** The cards of a day that can be deleted, as selection entries (none on days of another month). */
  const cardsOfDay = (date: string) => {
    const { day, countedIn } = dayView(date);
    return countedIn ? [] : cardRows(date, day, !date.startsWith(month)).map((row) => [`${date}|${row.key}`, { date, replaces: row.replaces, groupId: row.groupId }] as const);
  };
  /** Every card that can be deleted in the grid as shown (filter and weekend included). */
  const selectableCards = () => monthWeeks(month).flatMap((week) => week.slice(0, visibleDays)).flatMap(cardsOfDay);
  /** Selects (or unselects) all the cards of a day; selecting turns the selection mode on. */
  const toggleDay = (date: string, select: boolean) => {
    const keys = cardsOfDay(date);
    setSelected((current) => select
      ? { ...current, ...Object.fromEntries(keys) }
      : Object.fromEntries(Object.entries(current).filter(([key]) => !keys.some(([dayKey]) => dayKey === key))));
    if (select) setSelecting(true);
  };

  const dayRows = (date: string, day: CalendarDay | undefined, outside: boolean, editable: boolean) => {
    const visible = cardRows(date, day, outside);

    return (
      <div className="flex flex-1 flex-col gap-1.5 px-1.5 py-1.5">
        {visible.map((row) => {
          const names = row.teacherIds.map((id) => teacherNames.get(id) ?? "?").join(", ");
          const selectionKey = `${date}|${row.key}`;
          const isSelected = Boolean(selected[selectionKey]);
          const toggle = () => setSelected(({ [selectionKey]: previous, ...others }) =>
            previous ? others : { ...others, [selectionKey]: { date, replaces: row.replaces, groupId: row.groupId } });
          const opens = editable && (selecting || Boolean(row.activityId));
          return (
            <div key={row.key} className="relative">
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    // Not `disabled`: the tooltip still shows on cards that can't be edited.
                    aria-disabled={!opens}
                    aria-pressed={selecting && editable ? isSelected : undefined}
                    onClick={() => {
                      if (!opens) return;
                      if (selecting) toggle();
                      else if (row.activityId) setEditingActivity({ date, activityId: row.activityId, replaces: row.replaces, teacherIds: row.teacherIds, groupId: row.groupId, existing: true });
                    }}
                    className={`day-activity-card block w-full border border-l-[3px] py-1.5 pl-2 ${editable ? "pr-6" : "pr-2"} text-left transition ${opens ? "hover:shadow-sm hover:brightness-95" : "cursor-default"} ${isSelected ? "ring-2 ring-red-500 ring-offset-1" : ""}`}
                    style={accentStyle(row.color)}
                  >
                    <span className="block truncate text-[11px] font-bold leading-tight text-slate-800">{row.label}</span>
                    <span className={`block truncate text-[10px] leading-snug ${names ? "text-slate-600" : "italic text-slate-400"}`}>
                      {names || "Sense professor"}
                    </span>
                    {(row.time || row.participants !== undefined) && (
                      <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-600">
                        {row.time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{row.time}{row.endsAt && `–${row.endsAt}`}</span>}
                        {row.participants !== undefined && <span className="flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" />{row.participants}</span>}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="start" className="max-w-xs space-y-2 p-3 text-xs">
                  <section>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Professors</h3>
                    {row.teacherIds.length
                      ? <ul className="mt-0.5 text-slate-700">{row.teacherIds.map((id) => <li key={id}>{teacherNames.get(id) ?? "?"}</li>)}</ul>
                      : <p className="italic text-slate-400">Sense professor</p>}
                  </section>
                  {row.participants !== undefined && (
                    <p className="flex items-center gap-1 text-slate-700"><Users className="h-3 w-3" aria-hidden="true" />{row.participants} participants</p>
                  )}
                </TooltipContent>
              </Tooltip>
              {editable && selecting && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={toggle}
                  className="absolute right-1.5 top-1.5 h-3.5 w-3.5 cursor-pointer accent-red-600"
                  aria-label={`Seleccionar ${row.label}`}
                />
              )}
              {editable && !selecting && (
                <button
                  type="button"
                  onClick={() => window.confirm(`Eliminar «${row.label}» d'aquest dia?`) && deleteActivity(date, row.replaces, row.groupId)}
                  className="absolute right-1 top-1 p-0.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Eliminar ${row.label}`}
                  title="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
        {editable && !selecting && (
          <button
            type="button"
            onClick={() => setEditingActivity({ date, replaces: [], teacherIds: [], existing: false })}
            className="flex w-full items-center justify-center gap-1 border border-dashed border-slate-300 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:border-violet-400 hover:bg-violet-50/60 hover:text-violet-700"
            aria-label={`Afegir activitat el ${dayTitle(date)}`}
          >
            <Plus className="h-3 w-3" aria-hidden="true" /> Activitat
          </button>
        )}
      </div>
    );
  };
  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-4">
          <h1 className="sr-only">Calendari</h1>
          <div className="flex flex-wrap items-center gap-2">
            <MonthSelector selectedMonth={month} onChange={setMonth} />
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
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
              className={`flex h-10 items-center gap-2 border px-3 text-sm font-semibold transition ${selecting ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              <ListChecks className="h-4 w-4" /> Seleccionar
            </button>
          </div>
        </header>

        {selecting && (
          <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 border border-violet-200 bg-violet-50 px-4 py-2 shadow-sm">
            <span className="text-sm font-semibold text-violet-900">
              {Object.keys(selected).length ? `${Object.keys(selected).length} activitats seleccionades` : "Fes clic a les activitats per seleccionar-les"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setSelected(Object.fromEntries(selectableCards()))} className="px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-100">Seleccionar tot</button>
              {Object.keys(selected).length > 0 && (
                <button type="button" onClick={() => setSelected({})} className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white">Deseleccionar</button>
              )}
              <button
                type="button"
                disabled={!Object.keys(selected).length}
                onClick={() => {
                  const cards = Object.values(selected);
                  if (!window.confirm(`Eliminar ${cards.length} activitats dels seus dies?`)) return;
                  deleteCards(cards);
                  stopSelecting();
                }}
                className="flex items-center gap-1.5 bg-red-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar
              </button>
              <button type="button" onClick={stopSelecting} className="px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-white">Cancel·lar</button>
            </div>
          </div>
        )}

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
                          <div
                            key={date}
                            title={countedIn ? `Comptat a ${monthLabel(countedIn)}` : undefined}
                            className={`flex min-h-[132px] flex-col text-left ${countedIn ? "bg-slate-50 opacity-50" : ""} ${outside && !day ? "bg-slate-50/70" : ""} ${day?.incidents?.includes("holiday") ? "bg-amber-50/70" : ""}`}
                          >
                            <button
                              type="button"
                              disabled={Boolean(countedIn)}
                              onClick={() => setEditingDate(date)}
                              title={countedIn ? undefined : "Incidències, nota i professors sense activitat"}
                              aria-label={`Editar el dia ${dayTitle(date)}`}
                              className="group flex items-start justify-between gap-1 px-2 pt-1.5 text-left enabled:hover:bg-violet-50/60 disabled:cursor-not-allowed"
                            >
                              <span className={`text-xs font-bold ${outside ? "text-slate-400" : "text-slate-700"}`}>
                                {dayNumber}{outside && ` ${MONTHS_CA[Number(date.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}.`}
                                {countedIn && <span className="ml-1 font-normal">· {MONTHS_CA[Number(countedIn.slice(5)) - 1].toLowerCase()}</span>}
                                {!countedIn && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 border border-violet-200 bg-violet-50 px-1 py-px align-middle text-[10px] font-semibold text-violet-700 transition group-hover:border-violet-400 group-hover:bg-violet-100">
                                    <Pencil className="h-2.5 w-2.5" aria-hidden="true" /> Editar
                                  </span>
                                )}
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
                            </button>
                            {(() => {
                              const keys = cardsOfDay(date);
                              if (!keys.length) return null;
                              const count = keys.filter(([key]) => selected[key]).length;
                              return (
                                <label className={`mx-1.5 mt-1 flex cursor-pointer items-center gap-1.5 px-1 text-[10px] font-semibold transition ${count ? "text-red-700" : "text-slate-400 hover:text-slate-600"}`}>
                                  <input
                                    type="checkbox"
                                    checked={count === keys.length}
                                    ref={(input) => { if (input) input.indeterminate = count > 0 && count < keys.length; }}
                                    onChange={(event) => toggleDay(date, event.target.checked)}
                                    className="h-3 w-3 cursor-pointer accent-red-600"
                                  />
                                  {count ? `${count} de ${keys.length} seleccionades` : "Seleccionar el dia"}
                                </label>
                              );
                            })()}
                            {dayRows(date, day, outside, !countedIn)}
                            {day?.note && <span className="px-2 pb-1.5 pt-1 text-[11px] italic text-amber-700">{day.note}</span>}
                          </div>
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
          groupName={(groupId) => {
            const group = agendaGroups.data?.find((item) => item.id === groupId);
            return group ? `${schoolName(group)} · ${group.activityName ?? group.name}` : "Grup de l'agenda";
          }}
          onClose={() => setEditingDate(null)}
          onSave={(day) => { updateDay(editingDate, day); setEditingDate(null); }}
        />
      )}
      {editingActivity && (
        <ActivityEditor
          title={dayTitle(editingActivity.date)}
          activity={dayActivities.find((item) => item.id === editingActivity.activityId)}
          options={dayActivities.filter((item) => !current.days[editingActivity.date]?.assignments?.some((assignment) => assignment.activityId === item.id))}
          teacherIds={editingActivity.teacherIds}
          teachers={teachers}
          weekDay={weekDay(editingActivity.date)}
          onClose={() => setEditingActivity(null)}
          onDelete={editingActivity.existing ? () => { deleteActivity(editingActivity.date, editingActivity.replaces, editingActivity.groupId); setEditingActivity(null); } : undefined}
          onSave={(activityId, teacherIds) => { saveActivity(editingActivity.date, editingActivity.replaces, activityId, teacherIds); setEditingActivity(null); }}
        />
      )}
    </div>
  );
}
