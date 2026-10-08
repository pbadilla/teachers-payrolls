import { type CSSProperties, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";
import { AddSelect, type DayActivity } from "@/components/calendar/DayEditor";
import type { Teacher } from "@/types/teacher";

interface Props {
  /** The day, as "dilluns, 5 d'octubre de 2026". */
  title: string;
  /** The activity being edited; without it, one is picked from `options` (a new card). */
  activity?: DayActivity;
  /** Activities that can be added to the day (new card only). */
  options: DayActivity[];
  teacherIds: string[];
  teachers: Teacher[];
  /** Day of the week (1 = Monday): that weekday's activities are offered first. */
  weekDay: number;
  onSave: (activityId: string, teacherIds: string[]) => void;
  /** Deletes the card from the day (existing cards only). */
  onDelete?: () => void;
  onClose: () => void;
}

const accentStyle = (color: string) => ({ "--activity-accent": color }) as CSSProperties;

/** Edits one activity card of a day: which activity (when new) and its teachers. */
export function ActivityEditor({ title, activity, options, teacherIds, teachers, weekDay, onSave, onDelete, onClose }: Props) {
  const dialogRef = useDialogAccessibility(true, onClose);
  const [activityId, setActivityId] = useState(activity?.id ?? "");
  const [ids, setIds] = useState(teacherIds);
  const selected = activity ?? options.find((item) => item.id === activityId);
  const teacherName = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const sortedTeachers = [...teachers].sort((left, right) => left.name.localeCompare(right.name, "ca"));
  const ofWeekDay = options.filter((item) => !item.weekDay || item.weekDay === weekDay);
  const others = options.filter((item) => !ofWeekDay.includes(item));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="activity-editor-title" className="w-full max-w-md border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="activity-editor-title" className="text-sm font-extrabold normal-case">{activity ? activity.name : "Nova activitat"}</h2>
            <p className="text-xs text-slate-500 first-letter:uppercase">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100" aria-label="Tancar"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          {!activity && (
            <label className="block space-y-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              Activitat
              <select value={activityId} onChange={(event) => setActivityId(event.target.value)} className="block h-10 w-full border border-slate-300 bg-white px-2 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-violet-500">
                <option value="">Tria una activitat…</option>
                {ofWeekDay.length > 0 && <optgroup label="D'aquest dia">{ofWeekDay.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
                {others.length > 0 && <optgroup label="Altres dies">{others.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
              </select>
            </label>
          )}

          <section className={`space-y-2 ${selected ? "activity-card border border-l-4 px-3 py-2.5" : ""}`} style={selected ? accentStyle(selected.color) : undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Professors</h3>
              {selected?.places !== undefined && <span className="shrink-0 font-mono text-[11px] text-slate-500">{selected.places} places</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {ids.map((teacherId) => (
                <span key={teacherId} className="activity-pill inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold">
                  {teacherName.get(teacherId) ?? "?"}
                  <button type="button" onClick={() => setIds(ids.filter((id) => id !== teacherId))} aria-label={`Treure ${teacherName.get(teacherId) ?? "professor"}`} className="rounded-full p-0.5 hover:bg-white/60">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <AddSelect
                label="Afegir professor"
                placeholder="Afegir professor"
                options={sortedTeachers.filter((teacher) => !ids.includes(teacher.id))}
                onAdd={(teacherId) => setIds([...ids, teacherId])}
              />
            </div>
          </section>
        </div>

        <div className="flex justify-between gap-2 border-t border-slate-200 px-5 py-3">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Eliminar
            </button>
          ) : <span />}
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onSave(selected.id, ids)}
            className="bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Desar
          </button>
        </div>
      </div>
    </div>
  );
}
