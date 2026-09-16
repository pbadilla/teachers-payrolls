import { useState } from "react";
import { createPortal } from "react-dom";
import { Activity, HoursEntry, Teacher, TeacherRate } from "@/types/teacher";
import { useDialogAccessibility } from "@/hooks/use-dialog-accessibility";

interface Props {
  activities: Activity[];
  onAdd: (teacher: Omit<Teacher, "id">, entries: HoursEntry[]) => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
}

export function AddTeacherDialog({ activities, onAdd, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"coded" | "efectiu">("coded");
  const [rate, setRate] = useState(25);
  const [rates, setRates] = useState<TeacherRate[]>([]);
  const [hours, setHours] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useDialogAccessibility(open, () => setOpen(false));
  const billableActivities = activities.filter((activity) => activity.kind !== "school");
  const availableActivities = billableActivities.filter((activity) => !rates.some((item) => item.activityId === activity.id));
  const totalHours = rates.reduce((sum, item) => sum + (hours[item.activityId] ?? 0), 0);
  const totalAmount = rates.reduce((sum, item) => sum + (hours[item.activityId] ?? 0) * item.hourlyRate, 0);
  const totalHoursLabel = totalHours.toLocaleString("ca-ES", { maximumFractionDigits: 2 });

  const handleSubmit = async () => {
    if (!name.trim() || rates.length === 0 || totalHours <= 0 || submitting) return;
    setSubmitting(true);
    const entries = rates.map((item) => ({ ...item, hours: hours[item.activityId] ?? 0 }));
    const added = await onAdd({ code, name: name.trim(), type, hourlyRate: rate, rates }, entries);
    setSubmitting(false);
    if (added === false) return;
    setName(""); setCode(""); setRate(25); setRates([]); setHours({}); setType("coded");
    setOpen(false);
  };

  const addActivity = (activityId: string) => {
    if (!activityId) return;
    setRates((current) => [...current, { activityId, hourlyRate: rate }]);
    setHours((current) => ({ ...current, [activityId]: 0 }));
  };

  const updateActivityRate = (activityId: string, hourlyRate: number) => {
    setRates((current) => current.map((item) => item.activityId === activityId ? { ...item, hourlyRate } : item));
  };

  if (!open) {
    return (
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        + AFEGIR PROFE
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="add-teacher-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/80 bg-white text-slate-900 shadow-2xl shadow-slate-950/30" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><div id="add-teacher-title" className="text-sm font-extrabold tracking-wide">NOU PROFESSOR</div><button type="button" onClick={() => setOpen(false)} aria-label="Tancar" className="h-8 w-8 text-slate-500 hover:bg-slate-100">✕</button></div>
        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-slate-600">Nom</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" />
          </div>
          <div className="space-y-2">
            <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-slate-600">Codi (IBAN)</label>
            <input value={code} onChange={e => setCode(e.target.value)}
              className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
              placeholder="ES00 0000 0000 0000 0000 0000" />
          </div>
          <div className="space-y-2">
            <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-slate-600">Tipus i preu/hora</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-[1fr_1fr_110px]">
              <button className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${type === "coded" ? "bg-violet-600 text-white shadow-sm" : ""}`}
                onClick={() => setType("coded")}>TRANSFERÈNCIA</button>
              <button className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${type === "efectiu" ? "bg-violet-600 text-white shadow-sm" : ""}`}
                onClick={() => setType("efectiu")}>EFECTIU</button>
              <label className="relative col-span-2 h-11 sm:col-span-1 sm:h-auto">
                <span className="sr-only">Preu per hora per defecte</span>
                <input type="number" min="0" step="0.01" value={rate} onChange={e => setRate(Math.max(0, Number(e.target.value)))} className="h-full w-full border border-slate-200 bg-white px-2 pr-7 text-right font-mono text-sm text-slate-900 outline-none focus:border-violet-500" />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">€/h</span>
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">Activitats / escoles</div>
            {rates.length > 0 && <div className="grid grid-cols-[minmax(0,1fr)_92px_80px_36px] gap-2 px-3 text-[10px] font-bold uppercase tracking-wide text-slate-400"><span>Activitat</span><span className="text-right">Preu/h</span><span className="text-right">Hores</span><span /></div>}
            {rates.map((teacherRate) => {
              const activity = activities.find((item) => item.id === teacherRate.activityId);
              return <div key={teacherRate.activityId} className="grid grid-cols-[minmax(0,1fr)_92px_80px_36px] items-center gap-2 border border-slate-200 p-3">
                <span className="truncate text-sm font-semibold">{activity?.name ?? "Activitat"}</span>
                <label className="relative">
                  <span className="sr-only">Preu per hora de {activity?.name}</span>
                  <input type="number" min="0" step="0.01" value={teacherRate.hourlyRate} onChange={(event) => updateActivityRate(teacherRate.activityId, Number(event.target.value))} className="h-10 w-full border border-slate-200 bg-white px-2 pr-7 text-right font-mono text-sm outline-none focus:border-violet-500" />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">€</span>
                </label>
                <label className="relative">
                  <span className="sr-only">Hores de {activity?.name}</span>
                  <input type="number" min="0" step="1" value={hours[teacherRate.activityId] ?? 0} onChange={(event) => setHours((current) => ({ ...current, [teacherRate.activityId]: Math.max(0, Number(event.target.value)) }))} className="h-10 w-full border border-slate-200 bg-white px-2 pr-6 text-right font-mono text-sm outline-none focus:border-violet-500" title="Hores" />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">h</span>
                </label>
                <button type="button" onClick={() => { setRates((current) => current.filter((item) => item.activityId !== teacherRate.activityId)); setHours((current) => { const next = { ...current }; delete next[teacherRate.activityId]; return next; }); }} className="h-9 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${activity?.name ?? "activitat"}`}>✕</button>
              </div>;
            })}
            {availableActivities.length > 0 && <select value="" onChange={(event) => addActivity(event.target.value)} className="h-11 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500">
              <option value="">+ Assignar activitat / escola</option>
              {availableActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
            </select>}
            {billableActivities.length === 0 && <p className="border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Crea primer una activitat des de la secció “Activitats / Escoles”.</p>}
            {billableActivities.length > 0 && rates.length === 0 && <p className="text-xs text-slate-500">Assigna com a mínim una activitat per registrar el professor.</p>}
          </div>
          <div className="flex items-center justify-between bg-slate-100 p-4">
            <div><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total</div><div className="mt-1 font-mono text-xs text-slate-500">{totalHoursLabel} hores</div></div>
            <strong className="font-mono text-xl">{totalAmount.toFixed(2)} €</strong>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button disabled={submitting} onClick={() => setOpen(false)}
              className="h-11 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:bg-slate-100">
              CANCEL·LAR
            </button>
            <button disabled={!name.trim() || rates.length === 0 || totalHours <= 0 || submitting} onClick={() => void handleSubmit()}
              className="h-11 rounded-xl bg-violet-600 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "DESANT…" : "REGISTRAR"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
