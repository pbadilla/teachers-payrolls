import { type CSSProperties, useState } from "react";
import { Pencil, Plus, School, Trash2 } from "lucide-react";
import { type SchoolEdit, SchoolEditDialog } from "@/components/SchoolEditDialog";
import { NO_SCHOOL_COLOR, schoolColors, SECTION_LABELS, sectionOf, WEEK_DAY_NAMES } from "@/lib/school-colors";
import { type Activity, SCHOOL_SECTIONS, type SchoolSection, type Teacher } from "@/types/teacher";

interface Props {
  schools: Activity[];
  activities: Activity[];
  teachers: Teacher[];
  onAdd: (name: string, section: SchoolSection) => void;
  onSave: (edit: SchoolEdit) => Promise<boolean>;
  onDelete: (id: string) => void;
}

/** Schools, private lessons, casals and events in tabs: a form to add one and a slim card each. */
export function SchoolCards({ schools, activities, teachers, onAdd, onSave, onDelete }: Props) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SchoolSection>("schools");
  const sorted = [...schools]
    .filter((school) => sectionOf(school) === section)
    .sort((left, right) => left.name.localeCompare(right.name, "ca", { sensitivity: "base" }));
  const colors = schoolColors(schools);
  const teacherName = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));

  const add = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), section);
    setName("");
  };

  return (
    <section className="border border-foreground">
      <div className="ledger-header flex items-center justify-between">
        <span className="flex items-center gap-2"><School className="h-4 w-4" /> ESCOLES I ACTIVITATS</span>
        <span>{schools.length}</span>
      </div>
      <div className="space-y-4 p-4">
        <div role="tablist" aria-label="Seccions" className="flex flex-wrap gap-2">
          {SCHOOL_SECTIONS.map((value) => {
            const count = schools.filter((school) => sectionOf(school) === value).length;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={section === value}
                onClick={() => setSection(value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${section === value ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`}
              >
                {SECTION_LABELS[value].label} <span className="ml-1 font-mono text-xs opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex border border-foreground">
          <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && add()} placeholder={SECTION_LABELS[section].placeholder} aria-label={SECTION_LABELS[section].placeholder} className="min-w-0 flex-1 bg-background px-3 py-3 text-sm outline-none" />
          <button type="button" onClick={add} disabled={!name.trim()} className="flex items-center gap-1 border-l border-foreground px-5 text-xs font-heading uppercase transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> Afegir
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Encara no hi ha res a {SECTION_LABELS[section].label}.</p>
        ) : (
          <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((school) => {
              const schoolTeachers = (school.teacherIds ?? []).map((id) => teacherName.get(id)).filter(Boolean);
              const groups = activities
                .filter((activity) => activity.schoolId === school.id)
                .sort((left, right) => (left.weekDay ?? 0) - (right.weekDay ?? 0));
              return (
                <article key={school.id} className="school-card flex items-center gap-2 border border-l-4 px-3 py-2" style={{ "--school-accent": colors.get(school.id) ?? NO_SCHOOL_COLOR } as CSSProperties}>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold normal-case">{school.name}</h3>
                    <p className="truncate text-[11px] text-slate-500">
                      {groups.length
                        ? groups.map((group) => `${group.weekDay ? WEEK_DAY_NAMES[group.weekDay - 1] : "Tots els dies"}${group.places !== undefined ? ` · ${group.places}` : ""}`).join("  ·  ")
                        : "Sense activitats"}
                      {schoolTeachers.length > 0 && ` — ${schoolTeachers.join(", ")}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => setEditing(school)} aria-label={`Editar ${school.name}`} title="Editar" className="shrink-0 p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`Eliminar ${school.name}? Aquesta acció no es pot desfer.`)) onDelete(school.id); }}
                    aria-label={`Eliminar ${school.name}`}
                    className="shrink-0 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <SchoolEditDialog
          school={editing}
          groups={activities.filter((activity) => activity.schoolId === editing.id)}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={async (edit) => {
            setSaving(true);
            const ok = await onSave(edit);
            setSaving(false);
            if (ok) setEditing(null);
          }}
        />
      )}
    </section>
  );
}
