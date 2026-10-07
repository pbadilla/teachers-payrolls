import { AmountInput } from "./AmountInput";
import type { CalendarPayroll } from "./calendar/useCalendarPayroll";

interface Props {
  payroll: CalendarPayroll;
  monthLabel: string;
  locked: boolean;
}

const euros = (value: number) => `${value.toFixed(2)} €`;

/** The month's totals (the same figures as the payroll table), social security, income and balance. */
export function BalancePanel({ payroll, monthLabel, locked }: Props) {
  const { calendar, rows, change } = payroll;
  const teachersPay = rows.reduce((sum, row) => sum + row.pay, 0);
  const totalSessions = rows.reduce((sum, row) => sum + row.sessions, 0);
  const total = teachersPay + (calendar.socialSecurity ?? 0);
  const income = (calendar.schoolIncome ?? 0) + (calendar.shopIncome ?? 0);
  const payOf = (type: "coded" | "efectiu") => rows.filter((row) => row.teacher.type === type).reduce((sum, row) => sum + row.pay, 0);
  const amountRow = (label: string, key: "socialSecurity" | "schoolIncome" | "shopIncome") => (
    <div className="flex items-center justify-between gap-2 text-xs font-mono">
      <span className="text-muted-foreground">{label}</span>
      <AmountInput label={label} value={calendar[key]} placeholder="0" disabled={locked} onCommit={(value) => change({ ...calendar, [key]: value })} />
    </div>
  );

  return (
    <div className="sticky top-4 h-fit overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="ledger-header text-center">RESUM — {monthLabel.toUpperCase()}</div>

      <div className="space-y-4 p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-1 text-xs font-heading uppercase tracking-widest text-muted-foreground">Total a pagar</div>
          <div className="text-2xl font-mono font-bold tabular-nums text-destructive">{euros(total)}</div>
          <div className="mt-1 text-[11px] font-mono text-muted-foreground">Profes {euros(teachersPay)}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-1 text-[10px] font-heading uppercase tracking-widest text-muted-foreground">Sessions</div>
            <div className="text-lg font-mono font-bold tabular-nums">{totalSessions}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-1 text-[10px] font-heading uppercase tracking-widest text-muted-foreground">Profes</div>
            <div className="text-lg font-mono tabular-nums">{rows.length}</div>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-3">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">TRANSFERÈNCIA</span>
            <span className="tabular-nums text-destructive">{euros(payOf("coded"))}</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">EFECTIU</span>
            <span className="tabular-nums text-destructive">{euros(payOf("efectiu"))}</span>
          </div>
          {amountRow("SEG. SOCIAL", "socialSecurity")}
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-3">
          {amountRow("INGRESSOS ESCOLES", "schoolIncome")}
          {amountRow("INGRESSOS BOTIGA", "shopIncome")}
          <div className="flex justify-between text-xs font-mono font-bold">
            <span>SALDO</span>
            <span className={`tabular-nums ${income - total < 0 ? "text-destructive" : "text-emerald-700"}`}>{euros(income - total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
