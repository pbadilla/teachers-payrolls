import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Dataset, exportCsv, exportExcel, importSpreadsheet, PayrollData } from "@/lib/spreadsheet";

const emptyData: PayrollData = { teachers: [], activities: [], records: [] };
const datasetLabels: Record<Dataset, string> = { teachers: "Professors", activities: "Activitats", records: "Nòmines" };

export default function ImportExport() {
  const [data, setData] = useState<PayrollData>(emptyData);
  const [dataset, setDataset] = useState<Dataset>("teachers");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try { setData(await api.getData()); }
    catch { toast.error("No s'han pogut carregar les dades"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const handleImport = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await importSpreadsheet(file, dataset);
      const counts = await api.importData(parsed);
      await refresh();
      toast.success(`Importació completada: ${counts.teachers} professors, ${counts.activities} activitats i ${counts.records} nòmines`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No s'ha pogut importar el fitxer");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return <div className="min-h-screen p-4 lg:p-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border border-slate-200 bg-white/90 p-5 shadow-lg shadow-violet-950/5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:bg-violet-50 hover:text-violet-700" aria-label="Tornar"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex h-11 w-11 items-center justify-center bg-violet-100 text-violet-700"><FileSpreadsheet className="h-5 w-5" /></div>
          <div><h1 className="text-xl font-extrabold normal-case tracking-tight">Importar / Exportar</h1><p className="text-sm text-muted-foreground">Còpies de seguretat en Excel i CSV</p></div>
        </div>
        <Link to="/" className="px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-violet-50 hover:text-violet-700">Nòmines</Link>
      </header>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="border border-slate-200 bg-white/90 p-6 shadow-lg shadow-violet-950/5">
          <div className="mb-5 flex h-10 w-10 items-center justify-center bg-violet-100 text-violet-700"><Download className="h-5 w-5" /></div>
          <h2 className="text-lg font-bold">Exportar dades</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Descarrega una còpia completa en Excel o un únic conjunt de dades en CSV.</p>
          <button disabled={loading} onClick={() => void exportExcel(data)} className="mt-6 h-11 w-full bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">Descarregar Excel complet</button>
          <div className="mt-4 flex gap-2">
            <select value={dataset} onChange={(event) => setDataset(event.target.value as Dataset)} className="h-11 min-w-0 flex-1 border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-500">
              {(Object.keys(datasetLabels) as Dataset[]).map((key) => <option key={key} value={key}>{datasetLabels[key]}</option>)}
            </select>
            <button disabled={loading} onClick={() => void exportCsv(dataset, data)} className="h-11 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Descarregar CSV</button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-200 pt-5 text-center">
            <Count label="Professors" value={data.teachers.length} /><Count label="Activitats" value={data.activities.length} /><Count label="Nòmines" value={data.records.length} />
          </div>
        </article>

        <article className="border border-slate-200 bg-white/90 p-6 shadow-lg shadow-violet-950/5">
          <div className="mb-5 flex h-10 w-10 items-center justify-center bg-indigo-100 text-indigo-700"><Upload className="h-5 w-5" /></div>
          <h2 className="text-lg font-bold">Importar dades</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Els registres amb el mateix identificador s'actualitzen; la resta s'afegeixen. No s'elimina cap dada.</p>
          <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="csv-dataset">Tipus de dades per a CSV</label>
          <select id="csv-dataset" value={dataset} onChange={(event) => setDataset(event.target.value as Dataset)} className="mt-2 h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-violet-500">
            {(Object.keys(datasetLabels) as Dataset[]).map((key) => <option key={key} value={key}>{datasetLabels[key]}</option>)}
          </select>
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => void handleImport(event.target.files?.[0])} />
          <button disabled={importing} onClick={() => fileInput.current?.click()} className="mt-4 h-11 w-full bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50">{importing ? "Important…" : "Seleccionar Excel o CSV"}</button>
          <div className="mt-5 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">Excel: fulls <strong>Teachers</strong>, <strong>Activities</strong> i <strong>Records</strong>. CSV: capçaleres idèntiques a les del fitxer exportat.</div>
        </article>
      </section>
    </div>
  </div>;
}

function Count({ label, value }: { label: string; value: number }) {
  return <div><div className="font-mono text-xl font-bold text-slate-900">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div></div>;
}
