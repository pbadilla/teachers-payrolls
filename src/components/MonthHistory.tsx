import { MONTHS_CA, MonthlyRecord, recordHours } from "@/types/teacher";

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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="ledger-header text-center">HISTORIAL</div>
      <div className="max-h-[400px] overflow-y-auto">
        {months.map(m => {
          const [y, mn] = m.split("-").map(Number);
          const label = `${MONTHS_CA[mn - 1]} ${y}`;
          const monthRecords = records.filter(r => r.month === m);
          const totalHours = monthRecords.reduce((s, r) => s + recordHours(r), 0);
          const isActive = m === selectedMonth;

          return (
            <button
              key={m}
              onClick={() => onChange(m)}
              className={`flex w-full items-center justify-between border-b border-slate-200 px-3 py-2.5 text-left transition-colors ${
                isActive ? "bg-violet-600 text-white" : "hover:bg-slate-50"
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
      className="w-full px-3 py-2.5 text-center text-xs font-heading uppercase tracking-widest text-violet-700 transition-colors hover:bg-violet-50"
    >
      + NOU MES
    </button>
  );
}
