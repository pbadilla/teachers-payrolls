import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { calendarPayroll, type CalendarPayrollRow, countSessions, normalizeDay } from "@/lib/calendar";
import type { CalendarMonth } from "@/types/calendar";
import { MONTHS_CA, type Teacher } from "@/types/teacher";

const monthLabel = (month: string) => `${MONTHS_CA[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;

/**
 * The month's payroll as the Calendari gives it: sessions × rate (+ adjustment) per teacher, the
 * month's extra figures, saving them, and writing them to the payroll ("Aplicar a la nòmina").
 */
export function useCalendarPayroll(month: string, teachers: Teacher[], onApplied: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  // Same query as the Calendari page, so both show the same month.
  const query = useQuery({ queryKey: ["calendar", month], queryFn: () => api.getCalendar(month) });
  const loaded: CalendarMonth = query.data ?? { month, days: {} };
  // Days saved by an earlier version are converted, so saving keeps their activities.
  const calendar: CalendarMonth = { ...loaded, days: Object.fromEntries(Object.entries(loaded.days).map(([date, day]) => [date, normalizeDay(day)])) };
  const rows = calendarPayroll(calendar, teachers);
  const sessions = countSessions(calendar);

  /** Every teacher's figures, also those without sessions this month. */
  const rowFor = (teacher: Teacher): CalendarPayrollRow => {
    const count = sessions.get(teacher.id) ?? 0;
    const rate = calendar.rates?.[teacher.id] ?? teacher.hourlyRate;
    const adjustment = calendar.adjustments?.[teacher.id] ?? 0;
    return { teacher, sessions: count, rate, adjustment, pay: count * rate + adjustment };
  };

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
  });

  /** Sets (or clears, with undefined) a teacher's rate or adjustment for the month. */
  const setTeacherValue = (key: "rates" | "adjustments", teacherId: string, value: number | undefined) => {
    const values = { ...(calendar[key] ?? {}) };
    if (value === undefined || (key === "adjustments" && value === 0)) delete values[teacherId];
    else values[teacherId] = value;
    save.mutate({ ...calendar, [key]: values });
  };

  const apply = useMutation({
    mutationFn: () => api.applyCalendar(month, rows.map((row) => ({
      teacherId: row.teacher.id,
      hours: row.sessions,
      ...(calendar.rates?.[row.teacher.id] !== undefined ? { hourlyRate: row.rate } : {}),
      ...(row.adjustment ? { adjustment: row.adjustment } : {}),
    }))),
    onSuccess: async (result) => {
      await onApplied();
      await queryClient.invalidateQueries({ queryKey: ["payroll-data"] });
      toast.success(`Nòmina de ${monthLabel(month)} desada: ${result.updated} professors`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "No s'ha pogut desar la nòmina"),
  });

  const confirmApply = () => {
    if (window.confirm(`Es desarà la nòmina de ${monthLabel(month)} amb les sessions del calendari de ${rows.length} professors. Vols continuar?`)) apply.mutate();
  };

  return {
    calendar,
    rows,
    rowFor,
    loading: query.isLoading,
    error: query.isError,
    change: (updated: CalendarMonth) => save.mutate(updated),
    setTeacherValue,
    apply: confirmApply,
    applying: apply.isPending,
  };
}

export type CalendarPayroll = ReturnType<typeof useCalendarPayroll>;
