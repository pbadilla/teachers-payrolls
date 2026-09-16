import { useEffect, useState } from "react";
import { Activity, HoursEntry, Teacher, MonthlyRecord, PayrollMonthState, recordHours, recordPayment } from "@/types/teacher";
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Lock, Search, Unlock } from "lucide-react";
import { EditHoursDialog } from "./EditHoursDialog";
import { MonthSelector } from "./MonthSelector";
import { AddTeacherDialog } from "./AddTeacherDialog";

interface Props {
  teachers: Teacher[];
  records: MonthlyRecord[];
  activities: Activity[];
  selectedMonth: string;
  monthLabel: string;
  onMonthChange: (month: string) => void;
  onUpdateRecord: (teacherId: string, entries: HoursEntry[]) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onAddTeacher: (teacher: Omit<Teacher, "id">, entries: HoursEntry[]) => boolean | void | Promise<boolean | void>;
  payrollState: PayrollMonthState;
  onPayrollStateChange: (state: PayrollMonthState) => void;
  onCopyMonth: (sourceMonth: string, targetMonth: string) => Promise<boolean>;
}

const ITEMS_PER_PAGE = 15;

export function TeacherLedger({
  teachers, records, activities, selectedMonth, monthLabel,
  onMonthChange, onUpdateRecord, onUpdateTeacher, onDeleteTeacher, onAddTeacher,
  payrollState, onPayrollStateChange, onCopyMonth,
}: Props) {
  const [page, setPage] = useState(1);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "hours" | "total">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [missingOnly, setMissingOnly] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState("");

  const schools = activities.filter((item) => item.kind === "school");
  const activityOptions = activities.filter((item) => item.kind !== "school");

  const getHours = (teacherId: string) => {
    const rec = records.find(r => r.teacherId === teacherId && r.month === selectedMonth);
    return recordHours(rec);
  };

  const getPayment = (teacher: Teacher) => {
    return recordPayment(records.find(r => r.teacherId === teacher.id && r.month === selectedMonth), teacher);
  };

  const filteredTeachers = teachers.filter((teacher) => {
    const rates = teacher.rates ?? [];
    const matchesName = teacher.name.toLocaleLowerCase("ca").includes(query.trim().toLocaleLowerCase("ca"));
    const matchesPayment = !paymentFilter || teacher.type === paymentFilter;
    const matchesActivity = !activityFilter || rates.some((rate) => rate.activityId === activityFilter);
    const matchesSchool = !schoolFilter || rates.some((rate) => activityOptions.find((item) => item.id === rate.activityId)?.schoolId === schoolFilter);
    const matchesMissing = !missingOnly || getHours(teacher.id) === 0;
    return matchesName && matchesPayment && matchesActivity && matchesSchool && matchesMissing;
  }).sort((first, second) => {
    let comparison = first.name.localeCompare(second.name, "ca", { sensitivity: "base" });
    if (sortBy === "hours") comparison = getHours(first.id) - getHours(second.id);
    if (sortBy === "total") comparison = getPayment(first) - getPayment(second);
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE);
  const paged = filteredTeachers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const firstItem = filteredTeachers.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const lastItem = Math.min(page * ITEMS_PER_PAGE, filteredTeachers.length);
  const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    number => number === 1 || number === totalPages || Math.abs(number - page) <= 1,
  );

  useEffect(() => {
    if (page > Math.max(totalPages, 1)) setPage(Math.max(totalPages, 1));
  }, [page, totalPages]);

  useEffect(() => setPage(1), [query, schoolFilter, activityFilter, paymentFilter, missingOnly, sortBy, sortDirection, selectedMonth]);
  useEffect(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const next = new Date(year, month, 1);
    setDuplicateTarget(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }, [selectedMonth]);

  const totalHours = filteredTeachers.reduce((s, t) => s + getHours(t.id), 0);
  const totalPayment = filteredTeachers.reduce((s, t) => s + getPayment(t), 0);

  const previousMonth = (() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const previous = new Date(year, month - 2, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  })();

  const changeSort = (column: "name" | "hours" | "total") => {
    if (sortBy === column) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortBy(column);
    setSortDirection(column === "name" ? "asc" : "desc");
  };

  const SortIcon = ({ column }: { column: "name" | "hours" | "total" }) => {
    if (sortBy !== column) return <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 opacity-45" />;
    return sortDirection === "asc"
      ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
      : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />;
  };

  const handleSave = (teacher: Teacher, entries: HoursEntry[]) => {
    onUpdateRecord(teacher.id, entries);
    onUpdateTeacher(teacher);
    setFlashId(teacher.id);
    setTimeout(() => setFlashId(null), 300);
    setEditingTeacher(null);
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-tight">NÒMINES PROFES</h1>
          <span className="text-xs font-mono text-muted-foreground">{monthLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelector selectedMonth={selectedMonth} onChange={onMonthChange} />
          <AddTeacherDialog activities={activities} onAdd={onAddTeacher} disabled={payrollState.locked} />
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 p-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2">
            <span className="sr-only">Cercar professor</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cercar professor..." className="h-10 w-full border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-500" />
          </label>
          <select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)} aria-label="Filtrar per escola" className="h-10 border border-slate-300 bg-white px-3 text-sm"><option value="">Totes les escoles</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select>
          <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)} aria-label="Filtrar per activitat" className="h-10 border border-slate-300 bg-white px-3 text-sm"><option value="">Totes les activitats</option>{activityOptions.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select>
          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} aria-label="Filtrar per pagament" className="h-10 border border-slate-300 bg-white px-3 text-sm"><option value="">Tots els pagaments</option><option value="coded">Transferència</option><option value="efectiu">Efectiu</option></select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} /> Només sense hores</label>
          <span className="text-xs text-slate-500">{filteredTeachers.length} de {teachers.length} professors</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <select value={payrollState.status} onChange={(event) => onPayrollStateChange({ ...payrollState, status: event.target.value as "pending" | "paid" })} disabled={payrollState.locked} aria-label="Estat de pagament" className="h-9 border border-slate-300 bg-white px-3 text-xs font-bold uppercase disabled:opacity-50"><option value="pending">Pendent</option><option value="paid">Pagada</option></select>
          <button type="button" onClick={() => onPayrollStateChange({ ...payrollState, locked: !payrollState.locked })} className="flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold uppercase hover:bg-slate-100">{payrollState.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{payrollState.locked ? "Desbloquejar" : "Bloquejar"}</button>
          <button type="button" disabled={payrollState.locked} onClick={() => void onCopyMonth(previousMonth, selectedMonth)} className="flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold uppercase hover:bg-slate-100 disabled:opacity-40"><Copy className="h-4 w-4" />Copiar mes anterior</button>
          <div className="ml-auto flex items-center gap-2">
            <input type="month" value={duplicateTarget} onChange={(event) => setDuplicateTarget(event.target.value)} aria-label="Mes de destí" className="h-9 border border-slate-300 bg-white px-2 text-xs" />
            <button type="button" disabled={!duplicateTarget} onClick={() => void onCopyMonth(selectedMonth, duplicateTarget)} className="h-9 border border-slate-900 bg-slate-900 px-3 text-xs font-bold uppercase text-white disabled:opacity-40">Duplicar nòmina</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="ledger-header text-left w-8">#</th>
              <th className="ledger-header text-left" aria-sort={sortBy === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => changeSort("name")} className="inline-flex items-center gap-1.5 hover:text-violet-700">PROFES <SortIcon column="name" /></button>
              </th>
              <th className="ledger-header text-left hidden md:table-cell">CODI</th>
              <th className="ledger-header text-right" aria-sort={sortBy === "hours" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => changeSort("hours")} className="ml-auto flex items-center gap-1.5 hover:text-violet-700">HORES <SortIcon column="hours" /></button>
              </th>
              <th className="ledger-header text-right hidden sm:table-cell">ACT.</th>
              <th className="ledger-header text-right" aria-sort={sortBy === "total" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                <button type="button" onClick={() => changeSort("total")} className="ml-auto flex items-center gap-1.5 hover:text-violet-700">TOTAL (€) <SortIcon column="total" /></button>
              </th>
              <th className="ledger-header text-center w-12">✕</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((t, i) => {
              const rowIdx = (page - 1) * ITEMS_PER_PAGE + i + 1;
              const hours = getHours(t.id);
              const payment = getPayment(t);
              const isFlashing = flashId === t.id;
              return (
                <tr
                  key={t.id}
                  className={`${payrollState.locked ? "cursor-default" : "cursor-pointer"} bg-white transition-colors even:bg-slate-50/70 hover:!bg-violet-50/70 ${isFlashing ? "flash-patina" : ""}`}
                  onClick={() => !payrollState.locked && setEditingTeacher(t)}
                >
                  <td className="ledger-cell text-xs text-muted-foreground">{String(rowIdx).padStart(2, "0")}</td>
                  <td className="ledger-cell font-bold">
                    {t.name}
                    {t.type === "efectiu" && (
                      <span className="ml-2 text-xs text-muted-foreground">[EFECTIU]</span>
                    )}
                  </td>
                  <td className="ledger-cell text-xs text-muted-foreground hidden md:table-cell">
                    {t.code || "—"}
                  </td>
                  <td className="ledger-cell text-right tabular-nums">{hours}</td>
                  <td className="ledger-cell text-right tabular-nums text-muted-foreground hidden sm:table-cell">{(t.rates?.length ?? 0) || 1}</td>
                  <td className={`ledger-cell text-right tabular-nums font-bold ${payment > 0 ? "text-destructive" : "text-patina"}`}>
                    {payment.toFixed(2)}
                  </td>
                  <td className="ledger-cell text-center">
                    <button disabled={payrollState.locked}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Eliminar ${t.name}?`)) onDeleteTeacher(t.id);
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              <td className="ledger-header" colSpan={3}>TOTALS</td>
              <td className="ledger-header text-right tabular-nums">{totalHours}</td>
              <td className="ledger-header text-right tabular-nums hidden sm:table-cell"></td>
              <td className="ledger-header text-right tabular-nums text-destructive">{totalPayment.toFixed(2)}</td>
              <td className="ledger-header"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-white p-3 sm:flex-row">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Mostrant {firstItem}–{lastItem} de {filteredTeachers.length}
          </span>

          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button onClick={() => setPage(1)} disabled={page === 1} aria-label="Primera pàgina" className="h-9 border-r border-slate-200 px-3 font-mono text-xs hover:bg-slate-50 disabled:opacity-25">«</button>
            <button onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Pàgina anterior" className="h-9 border-r border-slate-200 px-3 font-mono text-xs hover:bg-slate-50 disabled:opacity-25">‹</button>

            {visiblePages.map((number, index) => {
              const previous = visiblePages[index - 1];
              return <span key={number} className="flex">
                {previous && number - previous > 1 && <span className="grid h-9 min-w-9 place-items-center border-r border-slate-200 text-xs">…</span>}
                <button
                  onClick={() => setPage(number)}
                  aria-current={number === page ? "page" : undefined}
                  className={`h-9 min-w-9 border-r border-slate-200 font-mono text-xs transition-colors ${number === page ? "bg-violet-600 text-white" : "hover:bg-slate-50"}`}
                >{String(number).padStart(2, "0")}</button>
              </span>;
            })}

            <button onClick={() => setPage(page + 1)} disabled={page === totalPages} aria-label="Pàgina següent" className="h-9 border-r border-slate-200 px-3 font-mono text-xs hover:bg-slate-50 disabled:opacity-25">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Última pàgina" className="h-9 px-3 font-mono text-xs hover:bg-slate-50 disabled:opacity-25">»</button>
          </div>

          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Pàgina {page} / {totalPages}
          </span>
        </div>
      )}

      {editingTeacher && (
        <EditHoursDialog
          teacher={editingTeacher}
          activities={activities}
          currentRecord={records.find(r => r.teacherId === editingTeacher.id && r.month === selectedMonth)}
          onSave={handleSave}
          onClose={() => setEditingTeacher(null)}
        />
      )}
    </div>
  );
}
