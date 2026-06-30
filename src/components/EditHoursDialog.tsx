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

  return <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-background border border-foreground w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
    <div className="ledger-header flex justify-between"><span>EDITAR — {teacher.name.toUpperCase()}</span><button onClick={onClose}>✕</button></div>
    <div className="p-4 space-y-3">
      <label className="text-xs font-heading block">NOM<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border border-foreground bg-background px-3 py-2 font-mono" /></label>
      <label className="text-xs font-heading block">IBAN<input value={code} onChange={e => setCode(e.target.value)} className="mt-1 w-full border border-foreground bg-background px-3 py-2 font-mono" /></label>
      <div className="flex border border-foreground"><button onClick={() => setType("coded")} className={`flex-1 p-2 text-xs ${type === "coded" ? "bg-foreground text-background" : ""}`}>TRANSFERÈNCIA</button><button onClick={() => setType("efectiu")} className={`flex-1 p-2 text-xs border-l border-foreground ${type === "efectiu" ? "bg-foreground text-background" : ""}`}>EFECTIU</button></div>
      <div className="ledger-header">ACTIVITATS, PREUS I HORES</div>
      {rates.map(rate => { const activity = activities.find(a => a.id === rate.activityId); const hours = entries.find(e => e.activityId === rate.activityId)?.hours ?? 0; return <div key={rate.activityId} className="grid grid-cols-[1fr_80px_80px_28px] gap-2 items-center text-xs"><span>{activity?.name ?? "Activitat"}</span><input type="number" step="0.01" value={rate.hourlyRate} onChange={e => updateRate(rate.activityId, Number(e.target.value))} className="border border-foreground bg-background p-2" title="€/hora" /><input type="number" value={hours} onChange={e => updateHours(rate.activityId, Number(e.target.value), rate.hourlyRate)} className="border border-foreground bg-background p-2" title="Hores" /><button onClick={() => { setRates(p => p.filter(r => r.activityId !== rate.activityId)); setEntries(p => p.filter(e => e.activityId !== rate.activityId)); }}>✕</button></div>; })}
      {available.length > 0 && <select value="" onChange={e => e.target.value && setRates(p => [...p, { activityId: e.target.value, hourlyRate: teacher.hourlyRate }])} className="w-full border border-foreground bg-background p-2 text-xs"><option value="">+ Assignar escola / activitat</option>{available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      <div className="border border-foreground p-3 flex justify-between"><span>TOTAL</span><strong>{total.toFixed(2)} €</strong></div>
      <button onClick={() => onSave({ ...teacher, name: name.trim(), code: code.trim(), type, rates }, entries)} className="w-full bg-foreground text-background p-3 text-xs">CONFIRMAR</button>
    </div>
  </div></div>;
}
