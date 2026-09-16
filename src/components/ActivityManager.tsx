import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { Activity, ActivityKind } from "@/types/teacher";

const ITEMS_PER_PAGE = 10;

type ActivityManagerProps = {
  activities: Activity[];
  onAdd: (name: string, kind: ActivityKind) => void;
  onDelete: (id: string) => void;
};

type ManagerPanelProps = {
  title: string;
  singular: string;
  placeholder: string;
  items: Activity[];
  onAdd: (name: string) => void;
  onDelete: (id: string) => void;
};

function ManagerPanel({ title, singular, placeholder, items, onAdd, onDelete }: ManagerPanelProps) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ca");
    return [...items]
      .filter((item) => item.name.toLocaleLowerCase("ca").includes(normalizedQuery))
      .sort((first, second) => first.name.localeCompare(second.name, "ca", { sensitivity: "base" }));
  }, [items, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));

  useEffect(() => setPage(1), [query]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const firstIndex = (page - 1) * ITEMS_PER_PAGE;
  const visibleItems = filteredItems.slice(firstIndex, firstIndex + ITEMS_PER_PAGE);
  const firstResult = filteredItems.length === 0 ? 0 : firstIndex + 1;
  const lastResult = Math.min(firstIndex + ITEMS_PER_PAGE, filteredItems.length);

  const addItem = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onAdd(trimmedName);
    setName("");
  };

  return (
    <section className="border border-foreground">
      <div className="ledger-header flex items-center justify-between">
        <span>{title}</span>
        <span>{items.length}</span>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex border border-foreground">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addItem()}
            placeholder={placeholder}
            aria-label={`${placeholder}`}
            className="min-w-0 flex-1 bg-background px-3 py-3 text-sm outline-none"
          />
          <button
            type="button"
            onClick={addItem}
            disabled={!name.trim()}
            className="border-l border-foreground px-5 text-xs font-heading uppercase transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            Afegir
          </button>
        </div>

        <div className="relative">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Cercar ${title.toLocaleLowerCase("ca")}...`}
            aria-label={`Cercar ${title.toLocaleLowerCase("ca")}`}
            className="w-full border border-border bg-background py-2.5 pl-10 pr-10 text-sm outline-none focus:border-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Netejar cerca"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Mostrant {firstResult}–{lastResult} de {filteredItems.length}</span>
          {query && <span>{items.length} en total</span>}
        </div>

        {items.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Encara no hi ha cap {singular}.
          </p>
        ) : filteredItems.length === 0 ? (
          <div className="border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No s’ha trobat cap resultat amb “{query.trim()}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-3 text-xs font-heading uppercase underline underline-offset-4">
              Netejar cerca
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border border border-foreground">
            {visibleItems.map((item, index) => (
              <div key={item.id} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">{firstIndex + index + 1}</span>
                  <span className="truncate font-mono">{item.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Eliminar ${item.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav aria-label={`Paginació de ${title.toLocaleLowerCase("ca")}`} className="flex items-center justify-between border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="flex h-9 items-center gap-1 border border-foreground px-3 text-xs font-heading uppercase transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Anterior
            </button>
            <span className="text-xs font-mono text-muted-foreground">Pàgina {page} de {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="flex h-9 items-center gap-1 border border-foreground px-3 text-xs font-heading uppercase transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-35"
            >
              Següent <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}

export function ActivityManager({ activities, onAdd, onDelete }: ActivityManagerProps) {
  const schools = activities.filter((item) => item.kind === "school");
  const activityItems = activities.filter((item) => item.kind !== "school");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <ManagerPanel
        title="ESCOLES"
        singular="escola"
        placeholder="Nova escola"
        items={schools}
        onAdd={(name) => onAdd(name, "school")}
        onDelete={onDelete}
      />
      <ManagerPanel
        title="ACTIVITATS"
        singular="activitat"
        placeholder="Nova activitat"
        items={activityItems}
        onAdd={(name) => onAdd(name, "activity")}
        onDelete={onDelete}
      />
    </div>
  );
}
