import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { calendarPayroll } from "@/lib/calendar";
import { Activity, MonthlyRecord, MONTHS_CA, Teacher } from "@/types/teacher";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Categorical slots 1 and 2 of the dataviz palette (validated: CVD ΔE 24.7, contrast ≥ 3:1).
const PAYMENT_COLORS = { coded: "#2a78d6", efectiu: "#eb6834" } as const;
const LINE_COLOR = "#2a78d6";
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
  const months = statsMonths();
  const calendars = useQueries({
    queries: months.map((month) => ({ queryKey: ["calendar", month], queryFn: () => api.getCalendar(month) })),
  });
  const rowsByMonth = months.map((month, index) => calendarPayroll(calendars[index].data ?? { month, days: {} }, teachers));
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

  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat label="Professors" value={teachers.length.toString()} />
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
  </div>;
}

function Empty({ text = "Encara no hi ha classes al calendari." }: { text?: string }) { return <p className="p-8 text-center text-muted-foreground">{text}</p>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="text-xs font-heading uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-2 text-3xl font-mono font-bold">{value}</div></div>; }
function Chart({ title, children }: { title: string; children: React.ReactNode }) { return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="ledger-header">{title}</div><div className="p-4">{children}</div></div>; }
