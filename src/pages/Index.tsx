import { useEffect, useState } from "react";
import { Activity, ActivityKind, HoursEntry, Teacher, MonthlyRecord, MONTHS_CA, PayrollMonthState } from "@/types/teacher";
import { initialTeachers, initialRecords } from "@/data/teachers";
import { TeacherLedger } from "@/components/TeacherLedger";
import { BalancePanel } from "@/components/BalancePanel";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ActivityManager } from "@/components/ActivityManager";
import { StatsPanel } from "@/components/StatsPanel";
import { createId } from "@/lib/id";
import { Button, Card } from "@heroui/react";
import { ArrowLeftRight, BarChart3, BookOpenCheck, GraduationCap, History, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const Index = () => {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [records, setRecords] = useState<MonthlyRecord[]>(initialRecords);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [payrollMonths, setPayrollMonths] = useState<PayrollMonthState[]>([]);
  const [activeTab, setActiveTab] = useState<"payroll" | "activities" | "stats">("payroll");

  const loadData = async () => {
      try {
        let data = await api.getData();
        if (data.teachers.length === 0) {
          await api.seed(initialTeachers, initialRecords);
          data = await api.getData();
        }
        setTeachers(data.teachers);
        setRecords(data.records);
        setActivities(data.activities ?? []);
        setPayrollMonths(data.payrollMonths ?? []);
      } catch (error) {
        console.error(error);
        toast.error("No s'ha pogut connectar amb la base de dades");
      }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const [year, monthNum] = selectedMonth.split("-").map(Number);
  const monthLabel = `${MONTHS_CA[monthNum - 1]} ${year}`;
  const payrollState = payrollMonths.find((item) => item.month === selectedMonth) ?? { month: selectedMonth, status: "pending" as const, locked: false };

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

  const handleAddActivity = async (name: string, kind: ActivityKind, schoolId?: string) => { const activity = { id: createId(), name, kind, ...(schoolId ? { schoolId } : {}) }; try { await api.addActivity(activity); setActivities(p => [...p, activity]); } catch { toast.error(`No s'ha pogut afegir ${kind === "school" ? "l'escola" : "l'activitat"}`); } };
  const handleDeleteActivity = async (id: string) => { if (teachers.some(t => t.rates?.some(r => r.activityId === id))) { toast.error("Aquesta activitat està assignada a un professor"); return; } try { await api.deleteActivity(id); setActivities(p => p.filter(a => a.id !== id)); } catch (error) { toast.error(error instanceof Error ? error.message : "No s'ha pogut eliminar"); } };

  const handlePayrollState = async (next: PayrollMonthState) => {
    try {
      const saved = await api.updatePayrollMonth(next);
      setPayrollMonths((current) => [...current.filter((item) => item.month !== saved.month), saved]);
      toast.success(saved.locked ? "Nòmina bloquejada" : "Estat de la nòmina actualitzat");
    } catch { toast.error("No s'ha pogut actualitzar l'estat de la nòmina"); }
  };

  const handleCopyMonth = async (sourceMonth: string, targetMonth: string) => {
    try {
      const result = await api.copyPayrollMonth(sourceMonth, targetMonth);
      await loadData();
      toast.success(`${result.copied} registres copiats`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No s'ha pogut copiar la nòmina");
      return false;
    }
  };

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

  const handleAdd = async (data: Omit<Teacher, "id">, entries: HoursEntry[]) => {
    const teacher = { ...data, id: createId() };
    try {
      await api.addTeacher(teacher);
      const hours = entries.reduce((sum, entry) => sum + entry.hours, 0);
      await api.updateRecord({ teacherId: teacher.id, month: selectedMonth, hours, entries });
      setTeachers(prev => [...prev, teacher]);
      setRecords(prev => [...prev, { teacherId: teacher.id, month: selectedMonth, hours, entries }]);
      return true;
    } catch (error) {
      console.error(error);
      try { await api.deleteTeacher(teacher.id); } catch { /* Best-effort rollback. */ }
      toast.error("No s'ha pogut afegir el professor");
      return false;
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
    <div className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-lg shadow-violet-950/5 backdrop-blur-xl">
          <Card.Content className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2"><h1 className="text-xl font-extrabold normal-case tracking-tight lg:text-2xl">Teachers Payrolls</h1><Sparkles className="h-4 w-4 text-violet-500" /></div>
                <p className="mt-1 text-sm text-muted-foreground">Gestió de nòmines, hores i activitats</p>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-2" aria-label="Seccions principals">
              <Button variant={activeTab === "payroll" ? "primary" : "ghost"} onPress={() => setActiveTab("payroll")}><BookOpenCheck className="h-4 w-4" />Nòmines</Button>
              <Button variant={activeTab === "activities" ? "primary" : "ghost"} onPress={() => setActiveTab("activities")}><GraduationCap className="h-4 w-4" />Activitats / Escoles</Button>
              <Button variant={activeTab === "stats" ? "primary" : "ghost"} onPress={() => setActiveTab("stats")}><BarChart3 className="h-4 w-4" />Estadístiques</Button>
              <Link to="/history" className="inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700">
                <History className="h-4 w-4" />Historial
              </Link>
              <Link to="/import-export" className="inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700">
                <ArrowLeftRight className="h-4 w-4" />Importar / Exportar
              </Link>
            </nav>
          </Card.Content>
        </Card>

        {activeTab === "payroll" ? (
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* Main Ledger */}
          <div className="min-w-0 flex-1 shadow-lg shadow-violet-950/5">
            <TeacherLedger
              teachers={teachers}
              records={records}
              activities={activities}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
              onMonthChange={setSelectedMonth}
              onUpdateRecord={handleUpdateRecord}
              onUpdateTeacher={handleUpdateTeacher}
              onDeleteTeacher={handleDelete}
              onAddTeacher={handleAdd}
              payrollState={payrollState}
              onPayrollStateChange={handlePayrollState}
              onCopyMonth={handleCopyMonth}
            />
          </div>

          {/* Monthly balance - right sidebar */}
          <div className="shrink-0 space-y-4 lg:w-[250px]">
            <BalancePanel
              teachers={teachers}
              records={records}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
            />
          </div>
        </div>
        ) : activeTab === "activities" ? (
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-lg shadow-violet-950/5 backdrop-blur-xl">
            <ActivityManager activities={activities} onAdd={handleAddActivity} onDelete={handleDeleteActivity} />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-lg shadow-violet-950/5 backdrop-blur-xl"><StatsPanel teachers={teachers} records={records} activities={activities} /></div>
        )}
      </div>
    </div>
  );
};

export default Index;
