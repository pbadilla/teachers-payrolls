import { useState } from "react";
import { createPortal } from "react-dom";
import { Teacher } from "@/types/teacher";

interface Props {
  onAdd: (teacher: Omit<Teacher, "id">) => boolean | void | Promise<boolean | void>;
}

export function AddTeacherDialog({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"coded" | "efectiu">("coded");
  const [rate, setRate] = useState(25);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    const added = await onAdd({ code, name: name.trim(), type, hourlyRate: rate });
    setSubmitting(false);
    if (added === false) return;
    setName(""); setCode(""); setRate(25); setType("coded");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-700"
      >
        + AFEGIR PROFE
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-teacher-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-white/80 bg-white text-slate-900 shadow-2xl shadow-slate-950/30" onClick={e => e.stopPropagation()}>
        <div id="add-teacher-title" className="border-b border-slate-200 px-6 py-4 text-sm font-extrabold tracking-wide">NOU PROFESSOR</div>
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
            <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-slate-600">Tipus</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${type === "coded" ? "bg-violet-600 text-white shadow-sm" : ""}`}
                onClick={() => setType("coded")}>TRANSFERÈNCIA</button>
              <button className={`rounded-lg px-3 py-2.5 text-xs font-bold transition ${type === "efectiu" ? "bg-violet-600 text-white shadow-sm" : ""}`}
                onClick={() => setType("efectiu")}>EFECTIU</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block space-y-2 text-xs font-bold uppercase tracking-wider text-slate-600">Preu/hora (€)</label>
            <input type="number" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))}
              className="block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 tabular-nums" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button disabled={submitting} onClick={() => setOpen(false)}
              className="h-11 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600 transition hover:bg-slate-100">
              CANCEL·LAR
            </button>
            <button disabled={!name.trim() || submitting} onClick={() => void handleSubmit()}
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
