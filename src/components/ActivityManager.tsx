import { useState } from "react";
import type { Activity } from "@/types/teacher";

export function ActivityManager({ activities, onAdd, onDelete }: { activities: Activity[]; onAdd: (name: string) => void; onDelete: (id: string) => void }) {
  const [name, setName] = useState("");
  return <div className="border border-foreground"><div className="ledger-header flex justify-between"><span>ESCOLES / ACTIVITATS</span><span>{activities.length}</span></div><div className="p-4 space-y-3">
    {activities.length === 0 && <p className="text-sm text-muted-foreground">Encara no hi ha cap escola o activitat.</p>}
    {activities.map(a => <div key={a.id} className="flex justify-between gap-2 border border-foreground px-3 py-3 text-sm font-mono"><span>{a.name}</span><button onClick={() => onDelete(a.id)} className="hover:text-destructive">✕</button></div>)}
    <div className="flex border border-foreground"><input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && name.trim()) { onAdd(name.trim()); setName(""); } }} placeholder="Nova escola o activitat" className="min-w-0 flex-1 bg-background px-3 py-3 text-sm outline-none" /><button onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(""); } }} className="border-l border-foreground px-5 text-xs font-heading uppercase hover:bg-foreground hover:text-background">Afegir</button></div>
  </div></div>;
}
