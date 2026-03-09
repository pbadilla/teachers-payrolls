import { MONTHS_CA } from "@/types/teacher";

interface Props {
  selectedMonth: string;
  onChange: (month: string) => void;
}

export function MonthSelector({ selectedMonth, onChange }: Props) {
  const [year, monthNum] = selectedMonth.split("-").map(Number);

  const prev = () => {
    const m = monthNum === 1 ? 12 : monthNum - 1;
    const y = monthNum === 1 ? year - 1 : year;
    onChange(`${y}-${String(m).padStart(2, "0")}`);
  };

  const next = () => {
    const m = monthNum === 12 ? 1 : monthNum + 1;
    const y = monthNum === 12 ? year + 1 : year;
    onChange(`${y}-${String(m).padStart(2, "0")}`);
  };

  const label = `${MONTHS_CA[monthNum - 1]} ${year}`;

  return (
    <div className="border border-foreground flex items-stretch">
      <button
        onClick={prev}
        className="px-4 py-2 border-r border-foreground font-mono text-sm hover:bg-secondary transition-colors"
      >
        ◄
      </button>
      <div className="flex-1 px-6 py-2 text-center font-heading text-sm uppercase tracking-widest">
        {label}
      </div>
      <button
        onClick={next}
        className="px-4 py-2 border-l border-foreground font-mono text-sm hover:bg-secondary transition-colors"
      >
        ►
      </button>
    </div>
  );
}
