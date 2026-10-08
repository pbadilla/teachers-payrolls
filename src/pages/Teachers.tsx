import { type CSSProperties, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/MonthSelector";
import { api } from "@/lib/api";
import { type CalendarSession, isSameSession, normalizeDay, shortDayLabel, teacherSessions } from "@/lib/calendar";
import { activityColors, NO_SCHOOL_COLOR } from "@/lib/school-colors";
import type { CalendarMonth } from "@/types/calendar";
import { MONTHS_CA } from "@/types/teacher";

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const accentStyle = (color: string) => ({ "--activity-accent": color }) as CSSProperties;
/** Suggested reasons; any other text can be typed. */
const REASONS = ["Malaltia", "Pluja", "Activitat cancel·lada", "Festiu", "Substituït per un altre professor"];
const TEACHERS_PER_PAGE = 10;
const sessionKey = (session: CalendarSession) => `${session.date}|${session.teacherId}|${session.activityId ?? session.row}`;

/**
 * Every session of the month per teacher, as the Calendari has them. A session can be marked as not
 * done with a reason: it is shown with a warning and doesn't count for pay.
 */
export default function Teachers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("month");
  const month = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonth;
  const setMonth = (next: string) => setSearchParams({ month: next });
  const [query, setQuery] = useState("");
  const [missedOnly, setMissedOnly] = useState(false);
  const [page, setPage] = useState(1);
  // Teachers whose list of sessions is open; all start closed.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleOpen = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  useEffect(() => setPage(1), [query, missedOnly, month]);
  // The session whose reason is being written, and the text.
  const [editing, setEditing] = useState<{ key: string; reason: string } | null>(null);
  const queryClient = useQueryClient();

  const payrollData = useQuery({ queryKey: ["payroll-data"], queryFn: api.getData });
  const calendar = useQuery({ queryKey: ["calendar", month], queryFn: () => api.getCalendar(month) });
  const current: CalendarMonth = calendar.data ?? { month, days: {} };

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
      toast.error(error instanceof Error ? error.message : "No s'ha pogut desar");
    },
    // Shows what the server really kept, not only what was sent.
    onSettled: (_data, _error, updated) => queryClient.invalidateQueries({ queryKey: ["calendar", updated.month] }),
  });

  /** Marks a session as not done (with its reason), or as done again (reason undefined). */
  const setMissed = (session: CalendarSession, reason?: string) => {
    const day = normalizeDay(current.days[session.date]);
    const others = (day.missed ?? []).filter((mark) => !isSameSession(mark, session));
    const mark = { teacherId: session.teacherId, ...(session.activityId ? { activityId: session.activityId } : { row: session.row }), reason: reason ?? "" };
    const missed = reason ? [...others, mark] : others;
    const { missed: _previous, ...rest } = day;
    save.mutate({ ...current, days: { ...current.days, [session.date]: { ...rest, ...(missed.length ? { missed } : {}) } } });
    setEditing(null);
  };

  const teachers = [...(payrollData.data?.teachers ?? [])].sort((left, right) => left.name.localeCompare(right.name, "ca"));
  const activities = payrollData.data?.activities ?? [];
  const activityName = new Map(activities.map((item) => [item.id, item.name]));
  const colorOfActivity = activityColors(activities);
  const withSessions = teachers
    .map((teacher) => ({ teacher, sessions: teacherSessions(current, teacher.id) }))
    .filter((item) => item.sessions.length);
  const search = query.trim().toLocaleLowerCase("ca");
  const matching = withSessions.filter((item) => item.teacher.name.toLocaleLowerCase("ca").includes(search));
  const shown = matching
    .map((item) => ({ ...item, visible: item.sessions.filter((session) => !missedOnly || session.missed) }))
    .filter((item) => item.visible.length);
  const allSessions = matching.flatMap((item) => item.sessions);
  const totalPages = Math.max(1, Math.ceil(shown.length / TEACHERS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = shown.slice((currentPage - 1) * TEACHERS_PER_PAGE, currentPage * TEACHERS_PER_PAGE);
  // A single teacher found by the search opens by itself.
  const isOpen = (id: string) => open.has(id) || shown.length === 1;
  const allOpen = paged.every((item) => isOpen(item.teacher.id));
  const missedCount = allSessions.filter((session) => session.missed).length;
  const monthName = `${MONTHS_CA[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;

  const activityPill = (session: CalendarSession) => session.activityId ? (
    <span className="activity-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={accentStyle(colorOfActivity.get(session.activityId) ?? NO_SCHOOL_COLOR)}>
      <span className="activity-swatch h-2 w-2 rounded-full" aria-hidden="true" />
      {activityName.get(session.activityId) ?? "Activitat eliminada"}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500">
      {session.row === "extra" ? "Sense activitat (fila blava)" : "Sense activitat"}
    </span>
  );

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-[1100px] space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-4">
          <div>
            <h1 className="font-heading text-2xl tracking-tight">SESSIONS PER PROFESSOR</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {monthName} · {allSessions.length - missedCount} fetes
              {missedCount > 0 && <span className="text-red-700"> · {missedCount} no fetes</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MonthSelector selectedMonth={month} onChange={setMonth} />
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border border-slate-200 bg-white p-3">
          <label className="relative min-w-[200px] flex-1">
            <span className="sr-only">Cercar professor</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cercar professor..." className="h-10 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-500" />
          </label>
          <label className="flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={missedOnly} onChange={(event) => setMissedOnly(event.target.checked)} /> Només no fetes
            </label>
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set([...open, ...paged.map((item) => item.teacher.id)]))}
            className="flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {allOpen ? <ChevronsDownUp className="h-4 w-4" aria-hidden="true" /> : <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />}
            {allOpen ? "Plegar tot" : "Desplegar tot"}
          </button>
          <span className="text-xs text-slate-500">{shown.length} professors</span>
        </div>

        {payrollData.isLoading || calendar.isLoading ? (
          <div className="border border-slate-200 bg-white p-12 text-center text-muted-foreground">Carregant sessions…</div>
        ) : payrollData.error || calendar.error ? (
          <div className="border border-red-200 bg-red-50 p-5 text-red-700">No s'han pogut carregar les sessions.</div>
        ) : !shown.length ? (
          <div className="border border-slate-200 bg-white p-12 text-center text-muted-foreground">
            {search ? "Cap professor amb aquest nom." : missedOnly ? "Cap sessió no feta aquest mes." : "Cap sessió al Calendari aquest mes."}
          </div>
        ) : (
          <>
            <datalist id="missed-reasons">{REASONS.map((reason) => <option key={reason} value={reason} />)}</datalist>
            {paged.map(({ teacher, sessions, visible }) => {
              const missed = sessions.filter((session) => session.missed).length;
              const expanded = isOpen(teacher.id);
              return (
                <section key={teacher.id} className="overflow-hidden border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleOpen(teacher.id)}
                    aria-expanded={expanded}
                    aria-controls={`sessions-${teacher.id}`}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3 text-left transition hover:bg-violet-50/60 ${expanded ? "border-b border-slate-200" : ""}`}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? "" : "-rotate-90"}`} aria-hidden="true" />
                      <span className="text-base font-bold normal-case">{teacher.name}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">{sessions.length - missed} fetes</span>
                      {missed > 0 && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-red-700">{missed} no fetes</span>}
                    </span>
                  </button>
                  {expanded && (
                  <ul id={`sessions-${teacher.id}`} className="divide-y divide-slate-100">
                    {visible.map((session) => {
                      const key = sessionKey(session);
                      const isEditing = editing?.key === key;
                      return (
                        <li key={key} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 ${session.missed ? "bg-red-50/40" : ""}`}>
                          <span className="w-20 shrink-0 font-bold tabular-nums text-slate-800">{shortDayLabel(session.date)}</span>
                          <span className={session.missed ? "opacity-60" : ""}>{activityPill(session)}</span>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            {session.missed ? (
                              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                No feta
                                <span className="truncate font-normal">· {session.missed.reason}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Feta
                              </span>
                            )}
                          </span>
                          {isEditing ? (
                            <form
                              className="flex w-full items-center gap-2 sm:w-auto"
                              onSubmit={(event) => { event.preventDefault(); if (editing.reason.trim()) setMissed(session, editing.reason.trim()); }}
                            >
                              <input
                                autoFocus
                                list="missed-reasons"
                                value={editing.reason}
                                onChange={(event) => setEditing({ key, reason: event.target.value })}
                                onKeyDown={(event) => event.key === "Escape" && setEditing(null)}
                                placeholder="Motiu (malaltia, pluja…)"
                                aria-label="Motiu"
                                className="h-9 min-w-0 flex-1 border border-slate-300 px-2 text-sm outline-none focus:border-violet-500 sm:w-64"
                              />
                              <button type="submit" disabled={!editing.reason.trim()} className="h-9 bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50">Desar</button>
                              <button type="button" onClick={() => setEditing(null)} className="h-9 px-2 text-slate-500 hover:bg-slate-100" aria-label="Cancel·lar"><X className="h-4 w-4" /></button>
                            </form>
                          ) : session.missed ? (
                            <span className="flex items-center gap-1">
                              <button type="button" onClick={() => setEditing({ key, reason: session.missed?.reason ?? "" })} className="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">Editar motiu</button>
                              <button type="button" onClick={() => setMissed(session)} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50">
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Marcar feta
                              </button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setEditing({ key, reason: "" })} className="flex items-center gap-1 border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> No feta
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  )}
                </section>
              );
            })}
            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-3" aria-label="Pàgines">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {(currentPage - 1) * TEACHERS_PER_PAGE + 1}–{Math.min(currentPage * TEACHERS_PER_PAGE, shown.length)} de {shown.length}
                </span>
                <div className="flex items-center overflow-hidden border border-slate-200">
                  <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Pàgina anterior" className="h-9 border-r border-slate-200 px-3 font-mono text-xs hover:bg-slate-50 disabled:opacity-25">‹</button>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setPage(number)}
                      aria-current={number === currentPage ? "page" : undefined}
                      className={`h-9 min-w-9 border-r border-slate-200 font-mono text-xs ${number === currentPage ? "bg-violet-600 text-white" : "hover:bg-slate-50"}`}
                    >
                      {String(number).padStart(2, "0")}
                    </button>
                  ))}
                  <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Pàgina següent" className="h-9 px-3 font-mono text-xs hover:bg-slate-50 disabled:opacity-25">›</button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
