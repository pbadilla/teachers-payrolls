import { useState } from "react";
import { Teacher, MonthlyRecord } from "@/types/teacher";
import { AddTeacherDialog } from "./AddTeacherDialog";
import { EditHoursDialog } from "./EditHoursDialog";

interface Props {
  teachers: Teacher[];
  records: MonthlyRecord[];
  selectedMonth: string;
  monthLabel: string;
  onUpdateRecord: (teacherId: string, hours: number) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onAddTeacher: (teacher: Omit<Teacher, "id">) => void;
  onDeleteTeacher: (id: string) => void;
}

const ITEMS_PER_PAGE = 15;

export function TeacherLedger({
  teachers, records, selectedMonth, monthLabel,
  onUpdateRecord, onUpdateTeacher, onAddTeacher, onDeleteTeacher
}: Props) {
  const [page, setPage] = useState(1);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const totalPages = Math.ceil(teachers.length / ITEMS_PER_PAGE);
  const paged = teachers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const getHours = (teacherId: string) => {
    const rec = records.find(r => r.teacherId === teacherId && r.month === selectedMonth);
    return rec?.hours ?? 0;
  };

  const getPayment = (teacher: Teacher) => {
    const h = getHours(teacher.id);
    return h * teacher.hourlyRate;
  };

  const totalHours = teachers.reduce((s, t) => s + getHours(t.id), 0);
  const totalPayment = teachers.reduce((s, t) => s + getPayment(t), 0);

  const handleSave = (teacher: Teacher, hours: number, rate: number) => {
    onUpdateRecord(teacher.id, hours);
    onUpdateTeacher({ ...teacher, hourlyRate: rate });
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
              <th className="ledger-header text-right hidden sm:table-cell">€/H</th>
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
                  className={`cursor-pointer hover:bg-secondary transition-colors ${isFlashing ? "flash-patina" : ""}`}
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
                  <td className="ledger-cell text-right tabular-nums text-muted-foreground hidden sm:table-cell">{t.hourlyRate.toFixed(2)}</td>
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
        <div className="border border-t-0 border-foreground p-3 flex items-center justify-center gap-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="page-indicator hover:text-foreground disabled:text-muted-foreground transition-colors"
          >
            ◄ PREV
          </button>
          <span className="page-indicator">
            [ PÀGINA {String(page).padStart(2, "0")} / {String(totalPages).padStart(2, "0")} ]
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="page-indicator hover:text-foreground disabled:text-muted-foreground transition-colors"
          >
            NEXT ►
          </button>
        </div>
      )}

      {editingTeacher && (
        <EditHoursDialog
          teacher={editingTeacher}
          currentHours={getHours(editingTeacher.id)}
          onSave={handleSave}
          onClose={() => setEditingTeacher(null)}
        />
      )}
    </div>
  );
}
