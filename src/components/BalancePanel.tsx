import { Teacher, MonthlyRecord } from "@/types/teacher";

interface Props {
  teachers: Teacher[];
  records: MonthlyRecord[];
  selectedMonth: string;
  monthLabel: string;
}

export function BalancePanel({ teachers, records, selectedMonth, monthLabel }: Props) {
  const getHours = (id: string) => records.find(r => r.teacherId === id && r.month === selectedMonth)?.hours ?? 0;
  const getPayment = (t: Teacher) => getHours(t.id) * t.hourlyRate;

  const totalHours = teachers.reduce((s, t) => s + getHours(t.id), 0);
  const totalPayment = teachers.reduce((s, t) => s + getPayment(t), 0);
  const codedPayment = teachers.filter(t => t.type === "coded").reduce((s, t) => s + getPayment(t), 0);
  const efectiuPayment = teachers.filter(t => t.type === "efectiu").reduce((s, t) => s + getPayment(t), 0);

  return (
    <div className="border border-foreground h-fit sticky top-4">
      <div className="ledger-header text-center">RESUM — {monthLabel.toUpperCase()}</div>
      
      <div className="p-4 space-y-4">
        <div className="border border-foreground p-3">
          <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-1">Total a pagar</div>
          <div className="text-2xl font-mono font-bold text-destructive tabular-nums">
            {totalPayment.toFixed(2)} €
          </div>
        </div>

        <div className="border border-foreground p-3">
          <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-1">Total hores</div>
          <div className="text-2xl font-mono font-bold tabular-nums">{totalHours}</div>
        </div>

        <div className="border border-foreground p-3">
          <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-1">Profes</div>
          <div className="text-lg font-mono tabular-nums">{teachers.length}</div>
        </div>

        <div className="border-t border-foreground pt-3 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">TRANSFERÈNCIA</span>
            <span className="tabular-nums text-destructive">{codedPayment.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">EFECTIU</span>
            <span className="tabular-nums text-destructive">{efectiuPayment.toFixed(2)} €</span>
          </div>
        </div>

        {/* Hours bar */}
        {totalHours > 0 && (
          <div className="border border-foreground p-3">
            <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-2">Distribució hores</div>
            <div className="flex h-4 border border-foreground overflow-hidden">
              {teachers.filter(t => getHours(t.id) > 0).map((t, i) => (
                <div
                  key={t.id}
                  className="h-full border-r border-foreground last:border-r-0"
                  style={{
                    width: `${(getHours(t.id) / totalHours) * 100}%`,
                    backgroundColor: i % 2 === 0 ? 'hsl(0 0% 10%)' : 'hsl(155 30% 32%)',
                  }}
                  title={`${t.name}: ${getHours(t.id)}h`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
