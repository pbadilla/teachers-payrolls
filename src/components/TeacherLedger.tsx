import { useEffect, useState } from "react";
import { Activity, HoursEntry, Teacher, MonthlyRecord, recordHours, recordPayment } from "@/types/teacher";
import { AddTeacherDialog } from "./AddTeacherDialog";
import { EditHoursDialog } from "./EditHoursDialog";
import { MonthSelector } from "./MonthSelector";

interface Props {
  teachers: Teacher[];
  records: MonthlyRecord[];
  activities: Activity[];
  selectedMonth: string;
  monthLabel: string;
  onMonthChange: (month: string) => void;
  onUpdateRecord: (teacherId: string, entries: HoursEntry[]) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onAddTeacher: (teacher: Omit<Teacher, "id">) => void;
  onDeleteTeacher: (id: string) => void;
}

const ITEMS_PER_PAGE = 15;

export function TeacherLedger({
  teachers, records, activities, selectedMonth, monthLabel,
  onMonthChange, onUpdateRecord, onUpdateTeacher, onAddTeacher, onDeleteTeacher
}: Props) {
  const [page, setPage] = useState(1);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const totalPages = Math.ceil(teachers.length / ITEMS_PER_PAGE);
  const paged = teachers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const firstItem = teachers.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const lastItem = Math.min(page * ITEMS_PER_PAGE, teachers.length);
  const visiblePages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    number => number === 1 || number === totalPages || Math.abs(number - page) <= 1,
  );

  useEffect(() => {
    if (page > Math.max(totalPages, 1)) setPage(Math.max(totalPages, 1));
  }, [page, totalPages]);

  const getHours = (teacherId: string) => {
    const rec = records.find(r => r.teacherId === teacherId && r.month === selectedMonth);
    return recordHours(rec);
  };

  const getPayment = (teacher: Teacher) => {
    return recordPayment(records.find(r => r.teacherId === teacher.id && r.month === selectedMonth), teacher);
  };

  const totalHours = teachers.reduce((s, t) => s + getHours(t.id), 0);
  const totalPayment = teachers.reduce((s, t) => s + getPayment(t), 0);

  const handleSave = (teacher: Teacher, entries: HoursEntry[]) => {
    onUpdateRecord(teacher.id, entries);
    onUpdateTeacher(teacher);
    setFlashId(teacher.id);
    setTimeout(() => setFlashId(null), 300);
    setEditingTeacher(null);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border border-foreground p-4 mb-0 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-widest">NÒMINES PROFES</h1>
          <span className="text-xs font-mono text-muted-foreground">{monthLabel}</span>
        </div>
        <MonthSelector selectedMonth={selectedMonth} onChange={onMonthChange} />
        <AddTeacherDialog onAdd={onAddTeacher} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="ledger-header text-left w-8">#</th>
              <th className="ledger-header text-left">PROFES</th>
              <th className="ledger-header text-left hidden md:table-cell">CODI</th>
              <th className="ledger-header text-right">HORES</th>
              <th className="ledger-header text-right hidden sm:table-cell">ACT.</th>
              <th className="ledger-header text-right">TOTAL (€)</th>
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
                  className={`cursor-pointer transition-colors odd:bg-background even:bg-secondary/55 hover:!bg-secondary ${isFlashing ? "flash-patina" : ""}`}
                  onClick={() => setEditingTeacher(t)}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Eliminar ${t.name}?`)) onDeleteTeacher(t.id);
                      }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-secondary">
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
        <div className="border border-t-0 border-foreground p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Mostrant {firstItem}–{lastItem} de {teachers.length}
          </span>

          <div className="flex items-center border border-foreground">
            <button onClick={() => setPage(1)} disabled={page === 1} aria-label="Primera pàgina" className="h-9 px-3 border-r border-foreground font-mono text-xs hover:bg-secondary disabled:opacity-25">«</button>
            <button onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Pàgina anterior" className="h-9 px-3 border-r border-foreground font-mono text-xs hover:bg-secondary disabled:opacity-25">‹</button>

            {visiblePages.map((number, index) => {
              const previous = visiblePages[index - 1];
              return <span key={number} className="flex">
                {previous && number - previous > 1 && <span className="h-9 min-w-9 grid place-items-center border-r border-foreground text-xs">…</span>}
                <button
                  onClick={() => setPage(number)}
                  aria-current={number === page ? "page" : undefined}
                  className={`h-9 min-w-9 border-r border-foreground font-mono text-xs transition-colors ${number === page ? "bg-foreground text-background" : "hover:bg-secondary"}`}
                >{String(number).padStart(2, "0")}</button>
              </span>;
            })}

            <button onClick={() => setPage(page + 1)} disabled={page === totalPages} aria-label="Pàgina següent" className="h-9 px-3 border-r border-foreground font-mono text-xs hover:bg-secondary disabled:opacity-25">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Última pàgina" className="h-9 px-3 font-mono text-xs hover:bg-secondary disabled:opacity-25">»</button>
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
