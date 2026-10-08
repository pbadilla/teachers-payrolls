import { useEffect, useState } from "react";
import { Activity, ActivityKind, HoursEntry, Teacher, MonthlyRecord, MONTHS_CA, PayrollMonthState, SchoolSection } from "@/types/teacher";
import { initialTeachers, initialRecords } from "@/data/teachers";
import { TeacherLedger } from "@/components/TeacherLedger";
import { BalancePanel } from "@/components/BalancePanel";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ActivityManager } from "@/components/ActivityManager";
import type { SchoolEdit } from "@/components/SchoolEditDialog";
import { StatsPanel } from "@/components/StatsPanel";
import { useCalendarPayroll } from "@/components/calendar/useCalendarPayroll";
import { createId } from "@/lib/id";
import { Button, Card } from "@heroui/react";

import { useSearchParams } from "react-router-dom";

const now = new Date();
const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const Index = () => {
  const [teachers, setTeachers] = useState<Teacher[]>(initialTeachers);
  const [records, setRecords] = useState<MonthlyRecord[]>(initialRecords);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [payrollMonths, setPayrollMonths] = useState<PayrollMonthState[]>([]);
  // The active tab lives in the URL (?tab=…) so the shared header can link to it.
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: "payroll" | "activities" | "stats" =
    requestedTab === "activities" || requestedTab === "stats" ? requestedTab : "payroll";

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
  // The month's payroll comes from the Calendari: one table (sessions × rate) and its totals.
  const payroll = useCalendarPayroll(selectedMonth, teachers, loadData);

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

  const handleAddActivity = async (name: string, kind: ActivityKind, schoolId?: string, section?: SchoolSection) => { const activity = { id: createId(), name, kind, ...(schoolId ? { schoolId } : {}), ...(section ? { section } : {}) }; try { await api.addActivity(activity); setActivities(p => [...p, activity]); } catch { toast.error(`No s'ha pogut afegir ${kind === "school" ? "l'escola" : "l'activitat"}`); } };
  /** Saves a school edited from its card: its name, its activities (new, changed) and the removed ones. */
  const handleSaveSchool = async ({ school, groups, removedIds }: SchoolEdit) => {
    try {
      const saved: Activity[] = [await api.updateActivity(school)];
      for (const group of groups) {
        const exists = activities.some((item) => item.id === group.id);
        if (exists) saved.push(await api.updateActivity({ ...group, weekDay: group.weekDay ?? null, places: group.places ?? null }));
        else saved.push(await api.addActivity(group));
      }
      for (const id of removedIds) await api.deleteActivity(id);
      setActivities((current) => [...current.filter((item) => !removedIds.includes(item.id) && !saved.some((next) => next.id === item.id)), ...saved]);
      toast.success(`${school.name} desada`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No s'ha pogut desar l'escola");
      await loadData();
      return false;
    }
  };
  const handleDeleteActivity = async (id: string) => { if (teachers.some(t => t.rates?.some(r => r.activityId === id))) { toast.error("Aquesta activitat està assignada a un professor"); return; } try { await api.deleteActivity(id); setActivities(p => p.filter(a => a.id !== id)); } catch (error) { toast.error(error instanceof Error ? error.message : "No s'ha pogut eliminar"); } };

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

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTeacher(id);
      setTeachers(prev => prev.filter(t => t.id !== id));
      setRecords(prev => prev.filter(r => r.teacherId !== id));
      setActivities(prev => prev.map(a => a.teacherIds?.includes(id) ? { ...a, teacherIds: a.teacherIds.filter(teacherId => teacherId !== id) } : a));
    } catch (error) {
      console.error(error);
      toast.error("No s'ha pogut eliminar el professor");
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {activeTab === "payroll" ? (
        <div className="space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* Main Ledger */}
          <div className="min-w-0 flex-1 shadow-lg shadow-violet-950/5">
            <TeacherLedger
              teachers={teachers}
              records={records}
              activities={activities}
              selectedMonth={selectedMonth}
              monthLabel={monthLabel}
              payroll={payroll}
              onMonthChange={setSelectedMonth}
              onUpdateRecord={handleUpdateRecord}
              onUpdateTeacher={handleUpdateTeacher}
              onDeleteTeacher={handleDelete}
              payrollState={payrollState}
            />
          </div>

          {/* Monthly balance - right sidebar */}
          <div className="shrink-0 space-y-4 lg:w-[250px]">
            <BalancePanel payroll={payroll} monthLabel={monthLabel} locked={payrollState.locked} />
          </div>
        </div>
        </div>
        ) : activeTab === "activities" ? (
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-lg shadow-violet-950/5 backdrop-blur-xl">
            <ActivityManager activities={activities} teachers={teachers} onAdd={handleAddActivity} onSaveSchool={handleSaveSchool} onDelete={handleDeleteActivity} />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white/90 p-5 shadow-lg shadow-violet-950/5 backdrop-blur-xl"><StatsPanel teachers={teachers} records={records} activities={activities} /></div>
        )}
      </div>
    </div>
  );
};

export default Index;
