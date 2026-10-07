import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";
import { createId } from "@/lib/id";
import { SECTION_LABELS, sectionOf, WEEK_DAY_NAMES } from "@/lib/school-colors";
import { type Activity, SCHOOL_SECTIONS, type SchoolSection } from "@/types/teacher";

export interface SchoolEdit {
  school: Activity;
  /** The school's activities after editing (new ones have a fresh id). */
  groups: Activity[];
  /** Activities removed from the school. */
  removedIds: string[];
}

interface Props {
  school: Activity;
  groups: Activity[];
  saving: boolean;
  onSave: (edit: SchoolEdit) => void;
  onClose: () => void;
}

const inputClass = "h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-violet-500";

/** Edits a school: its name, its tab (section) and its activities (name, day of the week, places). */
export function SchoolEditDialog({ school, groups, saving, onSave, onClose }: Props) {
  const dialogRef = useDialogAccessibility(true, onClose);
  const [name, setName] = useState(school.name);
  const [section, setSection] = useState<SchoolSection>(sectionOf(school));
  const [rows, setRows] = useState<Activity[]>(() => [...groups].sort((left, right) => (left.weekDay ?? 0) - (right.weekDay ?? 0)));
  const update = (id: string, changes: Partial<Activity>) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  const removedIds = groups.filter((group) => !rows.some((row) => row.id === group.id)).map((group) => group.id);
  const valid = name.trim() && rows.every((row) => row.name.trim());

  const addRow = () => setRows([...rows, { id: createId(), name: name.trim(), kind: "activity", schoolId: school.id }]);
  const removeRow = (row: Activity) => {
    const saved = groups.some((group) => group.id === row.id);
    if (saved && !window.confirm(`Eliminar l'activitat ${row.name}? Els dies del calendari on hi és assignada la mostraran com a eliminada.`)) return;
    setRows(rows.filter((item) => item.id !== row.id));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="school-edit-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 id="school-edit-title" className="text-sm font-extrabold normal-case">Editar {school.name}</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100" aria-label="Tancar"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-5">
          <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            Nom de l'escola
            <input value={name} onChange={(event) => setName(event.target.value)} className={`${inputClass} font-normal normal-case tracking-normal text-slate-900`} />
          </label>

          <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            Secció
            <select value={section} onChange={(event) => setSection(event.target.value as SchoolSection)} className={`${inputClass} font-normal normal-case tracking-normal text-slate-900`}>
              {SCHOOL_SECTIONS.map((value) => <option key={value} value={value}>{SECTION_LABELS[value].label}</option>)}
            </select>
          </label>

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Activitats</h3>
            {rows.length > 0 && (
              <div className="hidden grid-cols-[minmax(0,1fr)_140px_80px_36px] gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:grid">
                <span>Nom</span><span>Dia</span><span>Places</span><span />
              </div>
            )}
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 border-b border-slate-100 pb-2 sm:grid-cols-[minmax(0,1fr)_140px_80px_36px] sm:border-0 sm:pb-0">
                <input aria-label="Nom de l'activitat" value={row.name} onChange={(event) => update(row.id, { name: event.target.value })} className={inputClass} />
                <button type="button" onClick={() => removeRow(row)} aria-label={`Eliminar ${row.name}`} className="flex h-9 items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-600 sm:order-last">
                  <Trash2 className="h-4 w-4" />
                </button>
                <select aria-label="Dia de la setmana" value={row.weekDay ?? ""} onChange={(event) => update(row.id, { weekDay: event.target.value ? Number(event.target.value) : undefined })} className={inputClass}>
                  <option value="">Tots els dies</option>
                  {WEEK_DAY_NAMES.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}
                </select>
                <input aria-label="Places" inputMode="numeric" value={row.places ?? ""} onChange={(event) => update(row.id, { places: event.target.value.trim() === "" ? undefined : Math.max(0, Math.round(Number(event.target.value)) || 0) })} className={`${inputClass} text-right font-mono`} />
              </div>
            ))}
            <button type="button" onClick={addRow} className="inline-flex h-8 items-center gap-1 border border-dashed border-slate-400 px-3 text-xs font-semibold text-slate-600 hover:border-violet-500 hover:text-violet-700">
              <Plus className="h-3.5 w-3.5" /> Afegir activitat
            </button>
          </section>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel·lar</button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => onSave({ school: { ...school, name: name.trim(), section }, groups: rows.map((row) => ({ ...row, name: row.name.trim() })), removedIds })}
            className="bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? "Desant…" : "Desar"}
          </button>
        </div>
      </div>
    </div>
  );
}
