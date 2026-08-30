import { useState } from "react";
import { Activity, HoursEntry, MonthlyRecord, Teacher, TeacherRate } from "@/types/teacher";

interface Props { teacher: Teacher; activities: Activity[]; currentRecord?: MonthlyRecord; onSave: (teacher: Teacher, entries: HoursEntry[]) => void; onClose: () => void; }

export function EditHoursDialog({ teacher, activities, currentRecord, onSave, onClose }: Props) {
  const [name, setName] = useState(teacher.name);
  const [code, setCode] = useState(teacher.code);
  const [type, setType] = useState(teacher.type);
  const [rates, setRates] = useState<TeacherRate[]>(teacher.rates ?? []);
  const [entries, setEntries] = useState<HoursEntry[]>(currentRecord?.entries ?? []);
  const available = activities.filter(a => !rates.some(r => r.activityId === a.id));
  const total = entries.reduce((s, e) => s + e.hours * e.hourlyRate, 0);
  const updateRate = (activityId: string, hourlyRate: number) => { setRates(p => p.map(r => r.activityId === activityId ? { ...r, hourlyRate } : r)); setEntries(p => p.map(e => e.activityId === activityId ? { ...e, hourlyRate } : e)); };
  const updateHours = (activityId: string, hours: number, hourlyRate: number) => setEntries(p => p.some(e => e.activityId === activityId) ? p.map(e => e.activityId === activityId ? { ...e, hours, hourlyRate } : e) : [...p, { activityId, hours, hourlyRate }]);

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/80 bg-white text-slate-900 shadow-2xl shadow-slate-950/30" onClick={e => e.stopPropagation()}>
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur"><span className="font-heading text-sm font-extrabold tracking-wide">EDITAR — {teacher.name.toUpperCase()}</span><button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Tancar">✕</button></div>
    <div className="space-y-5 p-6">
      <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-slate-600">NOM<input value={name} onChange={e => setName(e.target.value)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
      <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-slate-600">IBAN<input value={code} onChange={e => setCode(e.target.value)} className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" /></label>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><button onClick={() => setType("coded")} className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${type === "coded" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>TRANSFERÈNCIA</button><button onClick={() => setType("efectiu")} className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${type === "efectiu" ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>EFECTIU</button></div>
      <div className="rounded-xl bg-violet-50 px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-violet-800">ACTIVITATS, PREUS I HORES</div>
      <div className="space-y-3">{rates.map(rate => { const activity = activities.find(a => a.id === rate.activityId); const hours = entries.find(e => e.activityId === rate.activityId)?.hours ?? 0; return <div key={rate.activityId} className="grid grid-cols-[minmax(0,1fr)_84px_84px_32px] items-center gap-2 rounded-xl border border-slate-200 p-3 text-xs"><span className="truncate font-semibold">{activity?.name ?? "Activitat"}</span><input type="number" step="0.01" value={rate.hourlyRate} onChange={e => updateRate(rate.activityId, Number(e.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-violet-500" title="€/hora" /><input type="number" value={hours} onChange={e => updateHours(rate.activityId, Number(e.target.value), rate.hourlyRate)} className="h-10 rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-violet-500" title="Hores" /><button className="h-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => { setRates(p => p.filter(r => r.activityId !== rate.activityId)); setEntries(p => p.filter(e => e.activityId !== rate.activityId)); }}>✕</button></div>; })}</div>
      {available.length > 0 && <select value="" onChange={e => e.target.value && setRates(p => [...p, { activityId: e.target.value, hourlyRate: teacher.hourlyRate }])} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500"><option value="">+ Assignar escola / activitat</option>{available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      <div className="flex items-center justify-between rounded-xl bg-slate-100 p-4"><span className="text-xs font-bold uppercase tracking-wider text-slate-500">TOTAL</span><strong className="text-xl">{total.toFixed(2)} €</strong></div>
      <button onClick={() => onSave({ ...teacher, name: name.trim(), code: code.trim(), type, rates }, entries)} className="h-12 w-full rounded-xl bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700">CONFIRMAR</button>
    </div>
  </div></div>;
}
