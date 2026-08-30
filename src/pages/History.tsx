import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock3, Euro, GraduationCap, History as HistoryIcon } from "lucide-react";
import { Card } from "@heroui/react";
import { api } from "@/lib/api";
import { MONTHS_CA, MonthlyRecord, Teacher, recordHours, recordPayment } from "@/types/teacher";

export default function History() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.getData()
      .then((data) => { setTeachers(data.teachers); setRecords(data.records); })
      .catch(() => setError("No s'ha pogut carregar l'historial."))
      .finally(() => setLoading(false));
  }, []);

  const months = useMemo(() => [...new Set(records.map((record) => record.month))].sort().reverse().map((month) => {
    const monthRecords = records.filter((record) => record.month === month);
    const [year, monthNumber] = month.split("-").map(Number);
    return {
      month,
      label: `${MONTHS_CA[monthNumber - 1]} ${year}`,
      hours: monthRecords.reduce((sum, record) => sum + recordHours(record), 0),
      amount: teachers.reduce((sum, teacher) => sum + recordPayment(monthRecords.find((record) => record.teacherId === teacher.id), teacher), 0),
      teachers: new Set(monthRecords.filter((record) => recordHours(record) > 0).map((record) => record.teacherId)).size,
    };
  }), [records, teachers]);

  return <div className="min-h-screen p-4 lg:p-8"><div className="mx-auto max-w-6xl space-y-6">
    <Card className="rounded-xl border border-slate-200 bg-white/90 shadow-lg shadow-violet-950/5 backdrop-blur-xl"><Card.Content className="flex items-center gap-4 p-5">
      <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-violet-50 hover:text-violet-700" aria-label="Tornar"><ArrowLeft className="h-5 w-5" /></Link>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><HistoryIcon className="h-5 w-5" /></div>
      <div><h1 className="text-xl font-extrabold normal-case tracking-tight">Historial de nòmines</h1><p className="text-sm text-muted-foreground">Resum mensual d'hores i imports</p></div>
    </Card.Content></Card>

    {loading ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-muted-foreground">Carregant historial…</div> : error ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div> : months.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-12 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-slate-400" /><p className="font-semibold">Encara no hi ha dades històriques.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{months.map((item) => <Card key={item.month} className="rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg"><Card.Content className="space-y-5 p-5">
      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-600">{item.month}</p><h2 className="mt-1 text-lg font-bold capitalize">{item.label}</h2></div><CalendarDays className="h-5 w-5 text-slate-400" /></div>
      <div className="grid grid-cols-3 gap-2"><Metric icon={Clock3} label="Hores" value={item.hours.toFixed(1)} /><Metric icon={Euro} label="Import" value={`${item.amount.toFixed(2)} €`} /><Metric icon={GraduationCap} label="Profes" value={String(item.teachers)} /></div>
    </Card.Content></Card>)}</div>}
  </div></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"><Icon className="mb-2 h-4 w-4 text-violet-600" /><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 truncate font-mono text-sm font-bold" title={value}>{value}</p></div>;
}
