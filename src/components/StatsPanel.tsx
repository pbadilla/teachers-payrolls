import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { calendarPayroll, daySessions } from "@/lib/calendar";
import { Activity, MonthlyRecord, MONTHS_CA, Teacher } from "@/types/teacher";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Categorical slots 1 and 2 of the dataviz palette (validated: CVD ΔE 24.7, contrast ≥ 3:1).
const PAYMENT_COLORS = { coded: "#2a78d6", efectiu: "#eb6834" } as const;
const LINE_COLOR = "#2a78d6";
// Sessions done / not done: categorical blue + status critical (validated: CVD ΔE 23.8, contrast ≥ 3:1).
// Red/green failed the colour-blind check. Always shown with their labels in the legend.
const SESSION_COLORS = { done: "#2a78d6", missed: "#d03b3b" } as const;
const SESSION_LABELS = { done: "Fetes", missed: "No fetes" } as const;
const AXIS = { fontSize: 11, fill: "hsl(240 9% 46%)" };

const euros = (value: number, decimals = 2) =>
  `${value.toLocaleString("ca-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} €`;

/** First month with data: the club keeps nothing older. */
const DATA_START_MONTH = "2026-09";

/** Months from DATA_START_MONTH up to the current one (the last 12 at most). */
function statsMonths() {
  const now = new Date();
  const months: string[] = [];
  for (let date = new Date(2026, 8, 1); date <= now; date = new Date(date.getFullYear(), date.getMonth() + 1, 1)) {
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return months.filter((month) => month >= DATA_START_MONTH).slice(-12);
}

/** Statistics from the Calendari (the same figures as Nòmines), not only from saved payrolls. */
export function StatsPanel({ teachers }: { teachers: Teacher[]; records: MonthlyRecord[]; activities: Activity[] }) {
  const allMonths = statsMonths();
  const calendars = useQueries({
    queries: allMonths.map((month) => ({ queryKey: ["calendar", month], queryFn: () => api.getCalendar(month) })),
  });
  const calendarOf = (month: string) => calendars[allMonths.indexOf(month)]?.data ?? { month, days: {} };
  // Period shown by every figure and chart: from one month to another (all months at first).
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const from = range.from && allMonths.includes(range.from) ? range.from : allMonths[0];
  const to = range.to && allMonths.includes(range.to) ? range.to : allMonths[allMonths.length - 1];
  const months = allMonths.filter((month) => month >= from && month <= to);
  const quickRanges = [
    { label: "Aquest mes", from: allMonths[allMonths.length - 1] },
    { label: "Últims 3 mesos", from: allMonths[Math.max(0, allMonths.length - 3)] },
    { label: "Tot", from: allMonths[0] },
  ];
  const rowsByMonth = months.map((month) => calendarPayroll(calendarOf(month), teachers));
  const allRows = rowsByMonth.flat();

  const monthly = months.map((month, index) => {
    const [year, number] = month.split("-").map(Number);
    return {
      month: `${MONTHS_CA[number - 1].slice(0, 3)} ${String(year).slice(-2)}`,
      import: rowsByMonth[index].reduce((sum, row) => sum + row.pay, 0),
    };
  });

  // Euros paid by each payment method (not how many teachers use it).
  const payment = (["coded", "efectiu"] as const).map((type) => ({
    type,
    name: type === "coded" ? "Transferència" : "Efectiu",
    value: allRows.filter((row) => row.teacher.type === type).reduce((sum, row) => sum + row.pay, 0),
  }));
  const totalPaid = payment.reduce((sum, item) => sum + item.value, 0);
  const totalHours = allRows.reduce((sum, row) => sum + row.sessions, 0);
  const loading = calendars.some((query) => query.isLoading);

  // Sessions done and not done per teacher over the same months, most sessions first.
  const perTeacher = new Map<string, { done: number; missed: number }>();
  for (const month of months) {
    for (const [date, day] of Object.entries(calendarOf(month).days)) {
      for (const session of daySessions(date, day)) {
        const counts = perTeacher.get(session.teacherId) ?? { done: 0, missed: 0 };
        if (session.missed) counts.missed += 1;
        else counts.done += 1;
        perTeacher.set(session.teacherId, counts);
      }
    }
  }
  const sessionsByTeacher = teachers
    .flatMap((teacher) => {
      const counts = perTeacher.get(teacher.id);
      return counts ? [{ name: teacher.name, ...counts }] : [];
    })
    .sort((left, right) => right.done + right.missed - (left.done + left.missed) || left.name.localeCompare(right.name, "ca"));
  const missedTotal = sessionsByTeacher.reduce((sum, item) => sum + item.missed, 0);

  const selectClass = "h-10 border border-slate-300 bg-white px-3 font-heading text-sm font-semibold uppercase tracking-wide outline-none focus:border-violet-500";
  return <div className="space-y-4">
    {/* One filter row above everything: the period applies to every figure and chart. */}
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Període</span>
      <label className="sr-only" htmlFor="stats-from">Des de</label>
      <select id="stats-from" value={from} onChange={(event) => setRange({ from: event.target.value, to: event.target.value > to ? event.target.value : to })} className={selectClass}>
        {allMonths.map((month) => <option key={month} value={month}>{longMonth(month)}</option>)}
      </select>
      <span className="text-sm text-slate-500">–</span>
      <label className="sr-only" htmlFor="stats-to">Fins a</label>
      <select id="stats-to" value={to} onChange={(event) => setRange({ from: event.target.value < from ? event.target.value : from, to: event.target.value })} className={selectClass}>
        {allMonths.map((month) => <option key={month} value={month}>{longMonth(month)}</option>)}
      </select>
      <div className="ml-auto flex flex-wrap gap-1">
        {quickRanges.map((item) => {
          const active = from === item.from && to === allMonths[allMonths.length - 1];
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={active}
              onClick={() => setRange({ from: item.from, to: allMonths[allMonths.length - 1] })}
              className={`h-9 px-3 text-xs font-semibold transition ${active ? "bg-violet-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Professors amb classes" value={sessionsByTeacher.filter((item) => item.done > 0).length.toString()} />
      <Stat label="Classes registrades" value={totalHours.toLocaleString("ca-ES")} />
      <Stat label="Import acumulat" value={euros(totalPaid)} />
    </div>
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Chart title="Evolució mensual (€)">
        {loading ? <Empty text="Carregant…" /> : monthly.some((item) => item.import > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthly} margin={{ top: 12, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke="hsl(240 20% 92%)" />
              <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={{ stroke: "hsl(240 20% 85%)" }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} tickFormatter={(value: number) => euros(value, 0)} />
              <Tooltip
                cursor={{ stroke: "hsl(240 20% 80%)", strokeWidth: 1 }}
                formatter={(value: number) => [euros(value), "Import"]}
                contentStyle={{ borderRadius: 4, borderColor: "hsl(240 20% 89%)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="import" stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff", fill: LINE_COLOR }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <Empty />}
      </Chart>
      <Chart title="Modalitat de pagament (€)">
        {loading ? <Empty text="Carregant…" /> : totalPaid > 0 ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <div className="h-[220px] w-[220px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={payment} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                    {payment.map((item) => <Cell key={item.type} fill={PAYMENT_COLORS[item.type]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${euros(value)} · ${Math.round((value / totalPaid) * 100)}%`, name]} contentStyle={{ borderRadius: 4, borderColor: "hsl(240 20% 89%)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend with the amounts: identity never by colour alone. */}
            <ul className="space-y-3">
              {payment.map((item) => (
                <li key={item.type} className="flex items-start gap-2">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[item.type] }} aria-hidden="true" />
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{item.name}</span>
                    <span className="block font-mono text-lg font-bold text-slate-900">{euros(item.value)}</span>
                    <span className="block text-xs text-slate-500">{Math.round((item.value / totalPaid) * 100)}% del total</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : <Empty />}
      </Chart>
    </div>
    <Chart title={`Sessions per professor · fetes i no fetes${months.length ? ` (${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])})` : ""}`}>
      {loading ? <Empty text="Carregant…" /> : sessionsByTeacher.length ? (
        <div className="space-y-3">
          {/* Legend with labels and totals: identity never by colour alone. */}
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {(["done", "missed"] as const).map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: SESSION_COLORS[key] }} aria-hidden="true" />
                <span className="font-semibold text-slate-700">{SESSION_LABELS[key]}</span>
                <span className="font-mono text-slate-500">{(key === "done" ? sessionsByTeacher.reduce((sum, item) => sum + item.done, 0) : missedTotal).toLocaleString("ca-ES")}</span>
              </li>
            ))}
          </ul>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={sessionsByTeacher} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke="hsl(240 20% 92%)" />
              {/* Names slanted so every teacher keeps its label. */}
              <XAxis dataKey="name" interval={0} angle={-45} textAnchor="end" height={80} tick={{ ...AXIS, fill: "hsl(240 10% 25%)" }} tickLine={false} axisLine={{ stroke: "hsl(240 20% 85%)" }} />
              <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                cursor={{ fill: "hsl(240 30% 96%)" }}
                formatter={(value: number, key: string) => [value, SESSION_LABELS[key as keyof typeof SESSION_LABELS]]}
                contentStyle={{ borderRadius: 4, borderColor: "hsl(240 20% 89%)", fontSize: 12 }}
              />
              <Bar dataKey="done" name="done" fill={SESSION_COLORS.done} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
              <Bar dataKey="missed" name="missed" fill={SESSION_COLORS.missed} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <Empty />}
    </Chart>
  </div>;
}

const longMonth = (month: string) => `${MONTHS_CA[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
const monthLabel = (month: string) => `${MONTHS_CA[Number(month.slice(5)) - 1].slice(0, 3)} ${month.slice(2, 4)}`;

function Empty({ text = "Encara no hi ha classes al calendari." }: { text?: string }) { return <p className="p-8 text-center text-muted-foreground">{text}</p>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-xs font-heading uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-2 text-3xl font-mono font-bold">{value}</div></div>; }
function Chart({ title, children }: { title: string; children: React.ReactNode }) { return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="ledger-header">{title}</div><div className="p-4">{children}</div></div>; }
