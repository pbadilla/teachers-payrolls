import { Activity, MonthlyRecord, MONTHS_CA, Teacher, recordHours, recordPayment } from "@/types/teacher";
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function StatsPanel({ teachers, records, activities }: { teachers: Teacher[]; records: MonthlyRecord[]; activities: Activity[] }) {
  const months = [...new Set(records.map(r => r.month))].sort().slice(-12);
  const monthly = months.map(month => {
    const [year, number] = month.split("-").map(Number);
    return {
      month: `${MONTHS_CA[number - 1].slice(0, 3)} ${String(year).slice(-2)}`,
      hores: records.filter(r => r.month === month).reduce((sum, r) => sum + recordHours(r), 0),
      import: teachers.reduce((sum, teacher) => sum + recordPayment(records.find(r => r.month === month && r.teacherId === teacher.id), teacher), 0),
    };
  });
  const payment = ["coded", "efectiu"].map(type => ({
    name: type === "coded" ? "Transferència" : "Efectiu",
    value: teachers.filter(t => t.type === type).length,
  }));
  const activityHours = activities.map(activity => ({
    name: activity.name,
    hores: records.reduce((sum, record) => sum + (record.entries?.find(e => e.activityId === activity.id)?.hours ?? 0), 0),
  })).filter(item => item.hores > 0);
  const totalHours = records.reduce((sum, record) => sum + recordHours(record), 0);
  const totalPaid = teachers.reduce((sum, teacher) => sum + records.reduce((subtotal, record) => record.teacherId === teacher.id ? subtotal + recordPayment(record, teacher) : subtotal, 0), 0);

  return <div className="space-y-4">
    <div className="grid sm:grid-cols-3 gap-4">
      <Stat label="Professors" value={teachers.length.toString()} />
      <Stat label="Hores registrades" value={`${totalHours.toFixed(1)} h`} />
      <Stat label="Import acumulat" value={`${totalPaid.toFixed(2)} €`} />
    </div>
    <div className="grid xl:grid-cols-2 gap-4">
      <Chart title="Evolució mensual">
        <ResponsiveContainer width="100%" height={300}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis yAxisId="hours" /><YAxis yAxisId="money" orientation="right" /><Tooltip /><Legend /><Bar yAxisId="hours" dataKey="hores" fill="hsl(155 30% 32%)" /><Bar yAxisId="money" dataKey="import" fill="hsl(0 70% 48%)" /></BarChart></ResponsiveContainer>
      </Chart>
      <Chart title="Modalitat de pagament">
        <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={payment} dataKey="value" nameKey="name" outerRadius={100} fill="hsl(155 30% 32%)" label /><Tooltip /><Legend /></PieChart></ResponsiveContainer>
      </Chart>
      <div className="xl:col-span-2"><Chart title="Hores per activitat">
        {activityHours.length ? <ResponsiveContainer width="100%" height={300}><BarChart data={activityHours} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={130} /><Tooltip /><Bar dataKey="hores" fill="hsl(0 0% 10%)" /></BarChart></ResponsiveContainer> : <p className="p-8 text-center text-muted-foreground">Encara no hi ha hores vinculades a activitats.</p>}
      </Chart></div>
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="border border-foreground p-5"><div className="text-xs font-heading uppercase tracking-widest text-muted-foreground">{label}</div><div className="mt-2 text-3xl font-mono font-bold">{value}</div></div>; }
function Chart({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border border-foreground"><div className="ledger-header">{title}</div><div className="p-4">{children}</div></div>; }
