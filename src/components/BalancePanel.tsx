import { Teacher } from "@/types/teacher";

interface Props {
  teachers: Teacher[];
}

export function BalancePanel({ teachers }: Props) {
  const totalOwed = teachers.reduce((s, t) => s + t.totalOwed, 0);
  const totalHours = teachers.reduce((s, t) => s + (t.monthlyHours[0] || 0), 0);
  const codedTeachers = teachers.filter(t => t.type === "coded");
  const efectiuTeachers = teachers.filter(t => t.type === "efectiu");
  const codedOwed = codedTeachers.reduce((s, t) => s + t.totalOwed, 0);
  const efectiuOwed = efectiuTeachers.reduce((s, t) => s + t.totalOwed, 0);

  return (
    <div className="border border-foreground h-fit sticky top-4">
      <div className="ledger-header text-center">BALANÇ</div>
      
      <div className="p-4 space-y-4">
        <div className="border border-foreground p-3">
          <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-1">Total deute</div>
          <div className="text-2xl font-mono font-bold text-destructive tabular-nums">
            {totalOwed.toFixed(2)} €
          </div>
        </div>

        <div className="border border-foreground p-3">
          <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-1">Hores mes</div>
          <div className="text-2xl font-mono font-bold tabular-nums">
            {totalHours}
          </div>
        </div>

        <div className="border border-foreground p-3">
          <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-1">Profes</div>
          <div className="text-lg font-mono tabular-nums">{teachers.length}</div>
        </div>

        <div className="border-t border-foreground pt-3 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">CODED</span>
            <span className="tabular-nums text-destructive">{codedOwed.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">EFECTIU</span>
            <span className="tabular-nums text-destructive">{efectiuOwed.toFixed(2)} €</span>
          </div>
        </div>

        {/* Segmented hours bar */}
        <div className="border border-foreground p-3">
          <div className="text-xs font-heading uppercase tracking-widest text-muted-foreground mb-2">Distribució hores</div>
          <div className="flex h-4 border border-foreground overflow-hidden">
            {teachers.filter(t => t.monthlyHours[0] > 0).slice(0, 20).map((t, i) => (
              <div
                key={t.id}
                className="h-full border-r border-foreground last:border-r-0"
                style={{
                  width: `${(t.monthlyHours[0] / totalHours) * 100}%`,
                  backgroundColor: i % 2 === 0 ? 'hsl(0 0% 10%)' : 'hsl(155 30% 32%)',
                }}
                title={`${t.name}: ${t.monthlyHours[0]}h`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
