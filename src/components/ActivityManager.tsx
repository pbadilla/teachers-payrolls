import { SchoolCards } from "@/components/SchoolCards";
import type { SchoolEdit } from "@/components/SchoolEditDialog";
import type { Activity, ActivityKind, SchoolSection, Teacher } from "@/types/teacher";

type ActivityManagerProps = {
  activities: Activity[];
  teachers: Teacher[];
  onAdd: (name: string, kind: ActivityKind, schoolId?: string, section?: SchoolSection) => void;
  onSaveSchool: (edit: SchoolEdit) => Promise<boolean>;
  onDelete: (id: string) => void;
};

/** "Activitats / Escoles" tab: the schools, each with its groups (imported from the registrations system). */
export function ActivityManager({ activities, teachers, onAdd, onSaveSchool, onDelete }: ActivityManagerProps) {
  return (
    <SchoolCards
      schools={activities.filter((item) => item.kind === "school")}
      activities={activities.filter((item) => item.kind !== "school")}
      teachers={teachers}
      onAdd={(name, section) => onAdd(name, "school", undefined, section)}
      onSave={onSaveSchool}
      onDelete={onDelete}
    />
  );
}
