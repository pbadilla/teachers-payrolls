import { useState } from "react";
import { Teacher, MonthlyRecord, MONTHS_CA } from "@/types/teacher";
import { initialTeachers, initialRecords } from "@/data/teachers";
import { TeacherLedger } from "@/components/TeacherLedger";
import { BalancePanel } from "@/components/BalancePanel";
import { MonthSelector } from "@/components/MonthSelector";
import { MonthHistory } from "@/components/MonthHistory";

const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const Index = () => {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [records, setRecords] = useState<MonthlyRecord[]>(initialRecords);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);

  const [year, monthNum] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTHS_CA[monthNum - 1]} ${year}`;

  const handleUpdateRecord = (teacherId: string, hours: number) => {
    setRecords(prev => {
      const existing = prev.findIndex(r => r.teacherId === teacherId && r.month === selectedMonth);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], hours };
        return updated;
      }
      return [...prev, { teacherId, month: selectedMonth, hours }];
    });
  };

  const handleUpdateTeacher = (updated: Teacher) => {
    setTeachers(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleAdd = (data: Omit<Teacher, "id">) => {
    setTeachers(prev => [...prev, { ...data, id: crypto.randomUUID() }]);
  };

  const handleDelete = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
    setRecords(prev => prev.filter(r => r.teacherId !== id));
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Month selector */}
        <div className="max-w-sm">
          <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
        </div>

        <div className="flex flex-col lg:flex-row gap-0">
          {/* Month History - left sidebar */}
          <div className="lg:w-[180px] shrink-0">
            <MonthHistory
              records={records}
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
            />
          </div>

          {/* Main Ledger */}
          <div className="flex-1 min-w-0">
            <TeacherLedger
              teachers={teachers}
              records={records}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
              onUpdateRecord={handleUpdateRecord}
              onUpdateTeacher={handleUpdateTeacher}
              onAddTeacher={handleAdd}
              onDeleteTeacher={handleDelete}
            />
          </div>

          {/* Balance Panel */}
          <div className="lg:w-[220px] shrink-0">
            <BalancePanel
              teachers={teachers}
              records={records}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
