import { type CSSProperties, useState } from "react";
import { Plus, X } from "lucide-react";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";
import { INCIDENT_STYLES } from "@/components/calendar/incidents";
import { type ActivityAssignment, type CalendarDay, DAY_INCIDENTS, type DayIncident } from "@/types/calendar";
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
  activities: DayActivity[];
  /** Day of the week being edited (1 = Monday): its activities are listed. */
  weekDay: number;
  onSave: (day: CalendarDay) => void;
  onClose: () => void;
}

const accentStyle = (color: string) => ({ "--activity-accent": color }) as CSSProperties;

/** Select that adds an item each time one is picked and goes back to its placeholder. */
function AddSelect({ label, placeholder, options, onAdd }: { label: string; placeholder: string; options: { id: string; name: string }[]; onAdd: (id: string) => void }) {
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
 * Edits one day by activity: each activity of that weekday lists its teachers (one or more), added
 * with a button. Teachers without an activity (loaded from the Excel) can be moved to one or removed.
 */
export function DayEditor({ title, day, teachers, activities, weekDay, onSave, onClose }: Props) {
  const dialogRef = useDialogAccessibility(true, onClose);
  const [assignments, setAssignments] = useState<ActivityAssignment[]>(day.assignments ?? []);
  const [main, setMain] = useState(day.main);
  const [extra, setExtra] = useState(day.extra);
  const [note, setNote] = useState(day.note ?? "");
  const [incidents, setIncidents] = useState<DayIncident[]>(day.incidents ?? []);
  const teacherName = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const sortedTeachers = [...teachers].sort((left, right) => left.name.localeCompare(right.name, "ca"));

  // This weekday's groups (and those without a fixed day), plus any other group already used today.
  const assignedIds = new Set(assignments.map((item) => item.activityId));
  const listed = activities.filter((activity) => !activity.weekDay || activity.weekDay === weekDay || assignedIds.has(activity.id));
  const others = activities.filter((activity) => !listed.includes(activity));
  const [extraActivities, setExtraActivities] = useState<string[]>([]);
  const shown = [...listed, ...others.filter((activity) => extraActivities.includes(activity.id))];

  const teachersOf = (activityId: string) => assignments.find((item) => item.activityId === activityId)?.teacherIds ?? [];
  const setTeachersOf = (activityId: string, teacherIds: string[]) =>
    setAssignments((current) => [...current.filter((item) => item.activityId !== activityId), ...(teacherIds.length ? [{ activityId, teacherIds }] : [])]);
  const addTeacher = (activityId: string, teacherId: string) => {
    setTeachersOf(activityId, [...teachersOf(activityId), teacherId]);
    // An Excel teacher given an activity is the same session, not a new one.
    if (main.includes(teacherId)) setMain(main.filter((id) => id !== teacherId));
    else if (extra.includes(teacherId)) setExtra(extra.filter((id) => id !== teacherId));
  };

  const unassigned = [...main.map((id) => ({ id, row: "main" as const })), ...extra.map((id) => ({ id, row: "extra" as const }))];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="day-editor-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 id="day-editor-title" className="text-sm font-extrabold normal-case first-letter:uppercase">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:bg-slate-100" aria-label="Tancar"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Activitats del dia</h3>
            {shown.length === 0 && <p className="text-sm text-slate-500">No hi ha activitats per a aquest dia.</p>}
            {shown.map((activity) => {
              const ids = teachersOf(activity.id);
              return (
                <article key={activity.id} className="activity-card border border-l-4 px-3 py-2.5" style={accentStyle(activity.color)}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-bold normal-case">{activity.name}</h4>
                    {activity.places !== undefined && <span className="shrink-0 font-mono text-[11px] text-slate-500">{activity.places} places</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {ids.map((teacherId) => (
                      <span key={teacherId} className="activity-pill inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold">
                        {teacherName.get(teacherId) ?? "?"}
                        <button type="button" onClick={() => setTeachersOf(activity.id, ids.filter((id) => id !== teacherId))} aria-label={`Treure ${teacherName.get(teacherId) ?? "professor"} de ${activity.name}`} className="rounded-full p-0.5 hover:bg-white/60">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <AddSelect
                      label={`Afegir professor a ${activity.name}`}
                      placeholder="Afegir professor"
                      options={sortedTeachers.filter((teacher) => !ids.includes(teacher.id))}
                      onAdd={(teacherId) => addTeacher(activity.id, teacherId)}
                    />
                  </div>
                </article>
              );
            })}
            <AddSelect
              label="Afegir una activitat d'un altre dia"
              placeholder="Afegir activitat"
              options={others.filter((activity) => !extraActivities.includes(activity.id))}
              onAdd={(activityId) => setExtraActivities([...extraActivities, activityId])}
            />
          </section>

          {unassigned.length > 0 && (
            <section className="space-y-2 border border-amber-200 bg-amber-50/60 p-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">Sense activitat</h3>
              <p className="text-[11px] text-amber-800">Venen de l'Excel. Afegeix-los a una activitat per moure'ls, o treu-los.</p>
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
          <button type="button" onClick={() => { setAssignments([]); setMain([]); setExtra([]); setNote(""); setIncidents([]); }} className="px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Buidar el dia</button>
          <button
            type="button"
            onClick={() => onSave({ main, extra, ...(note.trim() ? { note: note.trim() } : {}), ...(incidents.length ? { incidents } : {}), ...(assignments.length ? { assignments } : {}) })}
            className="bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700"
          >
            Desar
          </button>
        </div>
      </div>
    </div>
  );
}
