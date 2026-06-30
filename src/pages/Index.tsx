import { useEffect, useState } from "react";
import { Activity, HoursEntry, Teacher, MonthlyRecord, MONTHS_CA } from "@/types/teacher";
import { initialTeachers, initialRecords } from "@/data/teachers";
import { TeacherLedger } from "@/components/TeacherLedger";
import { BalancePanel } from "@/components/BalancePanel";
import { MonthHistory } from "@/components/MonthHistory";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ActivityManager } from "@/components/ActivityManager";
import { StatsPanel } from "@/components/StatsPanel";
import { createId } from "@/lib/id";

const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const Index = () => {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [records, setRecords] = useState<MonthlyRecord[]>(initialRecords);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState<"payroll" | "activities" | "stats">("payroll");

  useEffect(() => {
    const load = async () => {
      try {
        let data = await api.getData();
        if (data.teachers.length === 0) {
          await api.seed(initialTeachers, initialRecords);
          data = await api.getData();
        }
        setTeachers(data.teachers);
        setRecords(data.records);
        setActivities(data.activities ?? []);
      } catch (error) {
        console.error(error);
        toast.error("No s'ha pogut connectar amb la base de dades");
      }
    };
    void load();
  }, []);

  const [year, monthNum] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTHS_CA[monthNum - 1]} ${year}`;

  const handleUpdateRecord = async (teacherId: string, entries: HoursEntry[]) => {
    const hours = entries.reduce((sum, entry) => sum + entry.hours, 0);
    try {
      await api.updateRecord({ teacherId, month: selectedMonth, hours, entries });
    } catch (error) {
      console.error(error);
      toast.error("No s'han pogut desar les hores");
      return;
    }
    setRecords(prev => {
      const existing = prev.findIndex(r => r.teacherId === teacherId && r.month === selectedMonth);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], hours, entries };
        return updated;
      }
      return [...prev, { teacherId, month: selectedMonth, hours, entries }];
    });
  };

  const handleAddActivity = async (name: string) => { const activity = { id: createId(), name }; try { await api.addActivity(activity); setActivities(p => [...p, activity]); } catch { toast.error("No s'ha pogut afegir l'activitat"); } };
  const handleDeleteActivity = async (id: string) => { if (teachers.some(t => t.rates?.some(r => r.activityId === id))) { toast.error("Aquesta activitat està assignada a un professor"); return; } try { await api.deleteActivity(id); setActivities(p => p.filter(a => a.id !== id)); } catch { toast.error("No s'ha pogut eliminar l'activitat"); } };

  const handleUpdateTeacher = async (updated: Teacher) => {
    try {
      await api.updateTeacher(updated);
    } catch (error) {
      console.error(error);
      toast.error("No s'ha pogut actualitzar el professor");
      return;
    }
    setTeachers(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleAdd = async (data: Omit<Teacher, "id">) => {
    const teacher = { ...data, id: createId() };
    try {
      await api.addTeacher(teacher);
      setTeachers(prev => [...prev, teacher]);
    } catch (error) {
      console.error(error);
      toast.error("No s'ha pogut afegir el professor");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTeacher(id);
      setTeachers(prev => prev.filter(t => t.id !== id));
      setRecords(prev => prev.filter(r => r.teacherId !== id));
    } catch (error) {
      console.error(error);
      toast.error("No s'ha pogut eliminar el professor");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <nav className="flex border border-foreground w-fit">
          <button
            onClick={() => setActiveTab("payroll")}
            className={`px-6 py-3 text-xs font-heading uppercase tracking-widest ${activeTab === "payroll" ? "bg-foreground text-background" : "hover:bg-secondary"}`}
          >
            Nòmines
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={`px-6 py-3 border-l border-foreground text-xs font-heading uppercase tracking-widest ${activeTab === "activities" ? "bg-foreground text-background" : "hover:bg-secondary"}`}
          >
            Activitats / Escoles
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-6 py-3 border-l border-foreground text-xs font-heading uppercase tracking-widest ${activeTab === "stats" ? "bg-foreground text-background" : "hover:bg-secondary"}`}
          >
            Estadístiques
          </button>
        </nav>

        {activeTab === "payroll" ? (
        <div className="flex flex-col lg:flex-row gap-0">
          {/* Main Ledger */}
          <div className="flex-1 min-w-0">
            <TeacherLedger
              teachers={teachers}
              records={records}
              activities={activities}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
              onMonthChange={setSelectedMonth}
              onUpdateRecord={handleUpdateRecord}
              onUpdateTeacher={handleUpdateTeacher}
              onAddTeacher={handleAdd}
              onDeleteTeacher={handleDelete}
            />
          </div>

          {/* History and balance - right sidebar */}
          <div className="lg:w-[220px] shrink-0 space-y-4">
            <MonthHistory
              records={records}
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
            />
            <BalancePanel
              teachers={teachers}
              records={records}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
            />
          </div>
        </div>
        ) : activeTab === "activities" ? (
          <div className="max-w-2xl">
            <ActivityManager activities={activities} onAdd={handleAddActivity} onDelete={handleDeleteActivity} />
          </div>
        ) : (
          <StatsPanel teachers={teachers} records={records} activities={activities} />
        )}
      </div>
    </div>
  );
};

export default Index;
