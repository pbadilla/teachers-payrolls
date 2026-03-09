import { useState } from "react";
import { Teacher } from "@/types/teacher";
import { initialTeachers } from "@/data/teachers";
import { TeacherLedger } from "@/components/TeacherLedger";
import { BalancePanel } from "@/components/BalancePanel";

const MONTHS = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

const Index = () => {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const currentMonth = `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;

  const handleUpdate = (updated: Teacher) => {
    setTeachers(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleAdd = (data: Omit<Teacher, "id">) => {
    setTeachers(prev => [...prev, { ...data, id: crypto.randomUUID() }]);
  };

  const handleDelete = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-0">
          {/* Main Ledger - 80% */}
          <div className="lg:w-4/5">
            <TeacherLedger
              teachers={teachers}
              onUpdateTeacher={handleUpdate}
              onAddTeacher={handleAdd}
              onDeleteTeacher={handleDelete}
              currentMonth={currentMonth}
            />
          </div>

          {/* Balance Panel - 20% */}
          <div className="lg:w-1/5">
            <BalancePanel teachers={teachers} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
