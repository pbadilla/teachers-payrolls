import { useState } from "react";
import { Teacher } from "@/types/teacher";

interface Props {
  onAdd: (teacher: Omit<Teacher, "id">) => void;
}

export function AddTeacherDialog({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"coded" | "efectiu">("coded");
  const [hours, setHours] = useState(0);
  const [owed, setOwed] = useState(0);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({ code, name: name.trim(), type, monthlyHours: [hours], totalOwed: owed });
    setName(""); setCode(""); setHours(0); setOwed(0);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="border border-foreground px-4 py-2 text-xs font-heading uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
      >
        + AFEGIR PROFE
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div className="bg-background border border-foreground w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="ledger-header">NOU PROFESSOR</div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-heading uppercase tracking-widest block mb-1">Nom</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-foreground bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase tracking-widest block mb-1">Codi (IBAN)</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full border border-foreground bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
              placeholder="ES00 0000 0000 0000 0000 0000"
            />
          </div>
          <div>
            <label className="text-xs font-heading uppercase tracking-widest block mb-1">Tipus</label>
            <div className="flex border border-foreground">
              <button
                className={`flex-1 px-3 py-2 text-xs font-mono ${type === "coded" ? "bg-foreground text-background" : ""}`}
                onClick={() => setType("coded")}
              >CODED</button>
              <button
                className={`flex-1 px-3 py-2 text-xs font-mono border-l border-foreground ${type === "efectiu" ? "bg-foreground text-background" : ""}`}
                onClick={() => setType("efectiu")}
              >EFECTIU</button>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-heading uppercase tracking-widest block mb-1">Hores</label>
              <input
                type="number"
                value={hours}
                onChange={e => setHours(Number(e.target.value))}
                className="w-full border border-foreground bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-foreground tabular-nums"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-heading uppercase tracking-widest block mb-1">Deute (€)</label>
              <input
                type="number"
                step="0.01"
                value={owed}
                onChange={e => setOwed(Number(e.target.value))}
                className="w-full border border-foreground bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-foreground tabular-nums"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 border border-foreground px-4 py-2 text-xs font-heading uppercase tracking-widest hover:bg-secondary transition-colors"
            >
              CANCEL·LAR
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 border border-foreground bg-foreground text-background px-4 py-2 text-xs font-heading uppercase tracking-widest hover:bg-foreground/80 transition-colors"
            >
              REGISTRAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
