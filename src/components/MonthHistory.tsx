import { MONTHS_CA, MonthlyRecord } from "@/types/teacher";

interface Props {
  records: MonthlyRecord[];
  selectedMonth: string;
  onChange: (month: string) => void;
}

export function MonthHistory({ records, selectedMonth, onChange }: Props) {
  // Get unique months from records, plus current selected
  const monthsSet = new Set<string>();
  monthsSet.add(selectedMonth);
  records.forEach(r => monthsSet.add(r.month));

  const months = Array.from(monthsSet).sort().reverse();

  return (
    <div className="border border-foreground">
      <div className="ledger-header text-center">HISTORIAL</div>
      <div className="max-h-[400px] overflow-y-auto">
        {months.map(m => {
          const [y, mn] = m.split("-").map(Number);
          const label = `${MONTHS_CA[mn - 1]} ${y}`;
          const monthRecords = records.filter(r => r.month === m);
          const totalHours = monthRecords.reduce((s, r) => s + r.hours, 0);
          const isActive = m === selectedMonth;

          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className={`w-full text-left px-3 py-2 border-b border-foreground flex justify-between items-center transition-colors ${
                isActive ? "bg-foreground text-background" : "hover:bg-secondary"
              }`}
            >
              <span className="text-xs font-heading uppercase tracking-widest">{label}</span>
              <span className="text-xs font-mono tabular-nums">{totalHours}h</span>
            </button>
          );
        })}
      </div>
      {/* Add new month */}
      <NewMonthButton records={records} selectedMonth={selectedMonth} onChange={onChange} />
    </div>
  );
}

function NewMonthButton({ records, selectedMonth, onChange }: { records: MonthlyRecord[]; selectedMonth: string; onChange: (m: string) => void }) {
  const addNextMonth = () => {
    const allMonths = new Set<string>();
    allMonths.add(selectedMonth);
    records.forEach(r => allMonths.add(r.month));
    const sorted = Array.from(allMonths).sort();
    const latest = sorted[sorted.length - 1];
    const [y, m] = latest.split("-").map(Number);
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const key = `${nextY}-${String(nextM).padStart(2, "0")}`;
    onChange(key);
  };

  return (
    <button
      onClick={addNextMonth}
      className="w-full px-3 py-2 text-xs font-heading uppercase tracking-widest text-center hover:bg-foreground hover:text-background transition-colors"
    >
      + NOU MES
    </button>
  );
}
