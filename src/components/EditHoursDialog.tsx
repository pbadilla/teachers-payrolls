import { useState } from "react";
import { Teacher } from "@/types/teacher";

interface Props {
  teacher: Teacher;
  onSave: (teacher: Teacher, hours: number, owed: number) => void;
  onClose: () => void;
}

export function EditHoursDialog({ teacher, onSave, onClose }: Props) {
  const [hours, setHours] = useState(teacher.monthlyHours[0] || 0);
  const [owed, setOwed] = useState(teacher.totalOwed);

  return (
    <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background border border-foreground w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="ledger-header flex justify-between items-center">
          <span>EDITAR — {teacher.name.toUpperCase()}</span>
          <button onClick={onClose} className="text-sm hover:text-destructive">✕</button>
        </div>
        <div className="p-4 space-y-3">
          {teacher.code && (
            <div className="text-xs font-mono text-muted-foreground break-all">{teacher.code}</div>
          )}
          <div>
            <label className="text-xs font-heading uppercase tracking-widest block mb-1">Hores mes</label>
            <input
              type="number"
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              className="w-full border border-foreground bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-foreground tabular-nums"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase tracking-widest block mb-1">Deute total (€)</label>
            <input
              type="number"
              step="0.01"
              value={owed}
              onChange={e => setOwed(Number(e.target.value))}
              className="w-full border border-foreground bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-foreground tabular-nums"
            />
          </div>
          <button
            onClick={() => onSave(teacher, hours, owed)}
            className="w-full border border-foreground bg-foreground text-background px-4 py-3 text-xs font-heading uppercase tracking-widest hover:bg-foreground/80 transition-colors"
          >
            CONFIRMAR
          </button>
        </div>
      </div>
    </div>
  );
}
