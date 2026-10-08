import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";
import { INCIDENT_STYLES } from "@/components/calendar/incidents";
import { type CalendarDay, DAY_INCIDENTS, type DayIncident } from "@/types/calendar";
import type { Teacher } from "@/types/teacher";

export interface DayActivity {
  id: string;
  name: string;
  color: string;
  schoolId?: string;
  weekDay?: number;
  places?: number;
}

interface Props {
  title: string;
  /** Already normalized (see normalizeDay). */
  day: CalendarDay;
  teachers: Teacher[];
  /** Name of a group of the club's agenda (for the ones deleted from the day). */
  groupName: (groupId: string) => string;
  onSave: (day: CalendarDay) => void;
  onClose: () => void;
}

/** Select that adds an item each time one is picked and goes back to its placeholder. */
export function AddSelect({ label, placeholder, options, onAdd }: { label: string; placeholder: string; options: { id: string; name: string }[]; onAdd: (id: string) => void }) {
  if (!options.length) return null;
  return (
    <label className="relative inline-flex h-7 items-center gap-1 border border-dashed border-slate-400 bg-white px-2 text-xs font-semibold text-slate-600 hover:border-violet-500 hover:text-violet-700">
      <Plus className="h-3.5 w-3.5" /> {placeholder}
      <select aria-label={label} value="" onChange={(event) => event.target.value && onAdd(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

/**
 * Edits what belongs to the whole day: incidents, note and the teachers without an activity (loaded
 * from the Excel), which can be removed. Activities are edited one by one (see ActivityEditor).
 */
export function DayEditor({ title, day, teachers, groupName, onSave, onClose }: Props) {
  const dialogRef = useDialogAccessibility(true, onClose);
  const [assignments, setAssignments] = useState(day.assignments ?? []);
  const [main, setMain] = useState(day.main);
  const [extra, setExtra] = useState(day.extra);
  const [note, setNote] = useState(day.note ?? "");
  const [incidents, setIncidents] = useState<DayIncident[]>(day.incidents ?? []);
  const [hiddenGroups, setHiddenGroups] = useState(day.hiddenGroups ?? []);
  const teacherName = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const unassigned = [...main.map((id) => ({ id, row: "main" as const })), ...extra.map((id) => ({ id, row: "extra" as const }))];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="day-editor-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 id="day-editor-title" className="text-sm font-extrabold normal-case first-letter:uppercase">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100" aria-label="Tancar"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          {unassigned.length > 0 && (
            <section className="space-y-2 border border-amber-200 bg-amber-50/60 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">Sense activitat</h3>
              <p className="text-[11px] text-amber-800">Venen de l'Excel. Afegeix-los a una activitat (a la targeta del dia) per moure'ls, o treu-los.</p>
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map(({ id, row }) => (
                  <span key={`${row}-${id}`} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold ${row === "extra" ? "bg-sky-100 text-sky-900" : "bg-white text-slate-700"}`}>
                    {teacherName.get(id) ?? "?"}
                    <button type="button" onClick={() => (row === "main" ? setMain(main.filter((item) => item !== id)) : setExtra(extra.filter((item) => item !== id)))} aria-label={`Treure ${teacherName.get(id) ?? "professor"}`} className="rounded-full p-0.5 hover:bg-black/5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          )}

          {hiddenGroups.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Activitats de l'agenda eliminades</h3>
              <div className="flex flex-wrap gap-1.5">
                {hiddenGroups.map((groupId) => (
                  <span key={groupId} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-slate-600">
                    <span className="line-through">{groupName(groupId)}</span>
                    <button type="button" onClick={() => setHiddenGroups(hiddenGroups.filter((id) => id !== groupId))} className="rounded-full px-1.5 py-0.5 text-violet-700 hover:bg-violet-100">Recuperar</button>
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Incidències</h3>
            <div className="flex flex-wrap gap-2">
              {DAY_INCIDENTS.map((incident) => {
                const { label, icon: Icon, className } = INCIDENT_STYLES[incident];
                const active = incidents.includes(incident);
                return (
                  <button
                    key={incident}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setIncidents(active ? incidents.filter((item) => item !== incident) : [...incidents, incident])}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${active ? className : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                );
              })}
            </div>
          </section>

          <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            Nota / altres incidències
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Activitat cancel·lada, sortida…" className="block h-10 w-full border border-slate-300 px-3 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-violet-500" />
          </label>
        </div>

        <div className="sticky bottom-0 flex justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={() => { setAssignments([]); setMain([]); setExtra([]); setNote(""); setIncidents([]); setHiddenGroups([]); }} className="px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Buidar el dia</button>
          <button
            type="button"
            onClick={() => onSave({ main, extra, ...(note.trim() ? { note: note.trim() } : {}), ...(incidents.length ? { incidents } : {}), ...(assignments.length ? { assignments } : {}), ...(hiddenGroups.length ? { hiddenGroups } : {}), ...(day.missed?.length ? { missed: day.missed } : {}) })}
            className="bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700"
          >
            Desar
          </button>
        </div>
      </div>
    </div>
  );
}
