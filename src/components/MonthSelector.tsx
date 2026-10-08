import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/calendar";
import { MONTHS_CA } from "@/types/teacher";

interface Props {
  selectedMonth: string;
  onChange: (month: string) => void;
}

const arrowClass = "flex h-10 w-10 shrink-0 items-center justify-center border border-slate-300 bg-white transition hover:bg-slate-50";

/** Month and year of every page: previous / next arrows around a month and a year select. */
export function MonthSelector({ selectedMonth, onChange }: Props) {
  const [year, monthNum] = selectedMonth.split("-").map(Number);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);

  const changeMonth = (month: number) => {
    onChange(`${year}-${String(month).padStart(2, "0")}`);
  };

  const changeYear = (nextYear: number) => {
    onChange(`${nextYear}-${String(monthNum).padStart(2, "0")}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(shiftMonth(selectedMonth, -1))} className={arrowClass} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
      <label className="sr-only" htmlFor="payroll-month">Mes</label>
      <select
        id="payroll-month"
        value={monthNum}
        onChange={(event) => changeMonth(Number(event.target.value))}
        className="h-10 border border-slate-300 bg-white px-3 font-heading text-sm font-semibold uppercase tracking-wide outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
      >
        {MONTHS_CA.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
      </select>
      <label className="sr-only" htmlFor="payroll-year">Any</label>
      <select
        id="payroll-year"
        value={year}
        onChange={(event) => changeYear(Number(event.target.value))}
        className="h-10 border border-slate-300 bg-white px-3 font-mono text-sm font-semibold outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15"
      >
        {!years.includes(year) && <option value={year}>{year}</option>}
        {years.map((optionYear) => <option key={optionYear} value={optionYear}>{optionYear}</option>)}
      </select>
      <button type="button" onClick={() => onChange(shiftMonth(selectedMonth, 1))} className={arrowClass} aria-label="Mes següent"><ChevronRight className="h-4 w-4" /></button>
    </div>
  );
}
