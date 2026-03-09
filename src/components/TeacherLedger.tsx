import { useState } from "react";
import { Teacher } from "@/types/teacher";
import { AddTeacherDialog } from "./AddTeacherDialog";
import { EditHoursDialog } from "./EditHoursDialog";

interface Props {
  teachers: Teacher[];
  onUpdateTeacher: (teacher: Teacher) => void;
  onAddTeacher: (teacher: Omit<Teacher, "id">) => void;
  onDeleteTeacher: (id: string) => void;
  currentMonth: string;
}

const ITEMS_PER_PAGE = 15;

export function TeacherLedger({ teachers, onUpdateTeacher, onAddTeacher, onDeleteTeacher, currentMonth }: Props) {
  const [page, setPage] = useState(1);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const totalPages = Math.ceil(teachers.length / ITEMS_PER_PAGE);
  const paged = teachers.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const totalHours = teachers.reduce((s, t) => s + (t.monthlyHours[0] || 0), 0);
  const totalOwed = teachers.reduce((s, t) => s + t.totalOwed, 0);

  const handleSaveHours = (teacher: Teacher, hours: number, owed: number) => {
    onUpdateTeacher({ ...teacher, monthlyHours: [hours], totalOwed: owed });
    setFlashId(teacher.id);
    setTimeout(() => setFlashId(null), 300);
    setEditingTeacher(null);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border border-foreground p-4 mb-0 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-widest">HORES HIPOTECA</h1>
          <span className="text-xs font-mono text-muted-foreground">{currentMonth}</span>
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
              <th className="ledger-header text-left">CODI</th>
              <th className="ledger-header text-right">{currentMonth.split(" ")[0]?.toUpperCase()}</th>
              <th className="ledger-header text-right">DEUTE (€)</th>
              <th className="ledger-header text-center w-20">ACC.</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((t, i) => {
              const rowIdx = (page - 1) * ITEMS_PER_PAGE + i + 1;
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
                  <td className="ledger-cell text-xs text-muted-foreground">
                    {t.code || "—"}
                  </td>
                  <td className="ledger-cell text-right tabular-nums">
                    {t.monthlyHours[0]}
                  </td>
                  <td className={`ledger-cell text-right tabular-nums font-bold ${t.totalOwed > 0 ? "text-destructive" : "text-patina"}`}>
                    {t.totalOwed > 0 ? t.totalOwed.toFixed(2) : "0.00"}
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
              <td className="ledger-header text-right tabular-nums text-destructive">{totalOwed.toFixed(2)}</td>
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
          onSave={handleSaveHours}
          onClose={() => setEditingTeacher(null)}
        />
      )}
    </div>
  );
}
