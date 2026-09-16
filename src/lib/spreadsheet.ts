import type { Activity, MonthlyRecord, Teacher } from "@/types/teacher";

export type Dataset = "teachers" | "activities" | "records";
export type PayrollData = { teachers: Teacher[]; activities: Activity[]; records: MonthlyRecord[] };

const sheetNames: Record<Dataset, string> = { teachers: "Teachers", activities: "Activities", records: "Records" };

const safeJson = <T>(value: unknown, fallback: T): T => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try { return JSON.parse(value) as T; } catch { throw new Error("One of the JSON detail cells is invalid"); }
};

const serialize = (dataset: Dataset, data: PayrollData) => {
  if (dataset === "teachers") return data.teachers.map((teacher) => ({
    id: teacher.id, code: teacher.code, name: teacher.name, type: teacher.type,
    hourlyRate: teacher.hourlyRate, rates: JSON.stringify(teacher.rates ?? []),
  }));
  if (dataset === "activities") return data.activities.map(({ id, name, kind, schoolId }) => ({ id, name, kind: kind ?? "activity", schoolId: schoolId ?? "" }));
  return data.records.map((record) => ({
    teacherId: record.teacherId, month: record.month, hours: record.hours,
    entries: JSON.stringify(record.entries ?? []),
  }));
};

const parseRows = (dataset: Dataset, rows: Record<string, unknown>[]) => {
  if (dataset === "teachers") return rows.map((row, index) => {
    const teacher = {
      id: String(row.id ?? "").trim(), code: String(row.code ?? "").trim(), name: String(row.name ?? "").trim(),
      type: String(row.type ?? "").trim(), hourlyRate: Number(row.hourlyRate), rates: safeJson(row.rates, []),
    };
    if (!teacher.id || !teacher.name || !["coded", "efectiu"].includes(teacher.type) || !Number.isFinite(teacher.hourlyRate)) throw new Error(`Invalid teacher row ${index + 2}`);
    return teacher as Teacher;
  });
  if (dataset === "activities") return rows.map((row, index) => {
    const activity = { id: String(row.id ?? "").trim(), name: String(row.name ?? "").trim(), kind: String(row.kind ?? "activity").trim() || "activity", schoolId: String(row.schoolId ?? "").trim() || undefined };
    if (!activity.id || !activity.name || !["school", "activity"].includes(activity.kind)) throw new Error(`Invalid activity row ${index + 2}`);
    return activity;
  });
  return rows.map((row, index) => {
    const record = {
      teacherId: String(row.teacherId ?? "").trim(), month: String(row.month ?? "").trim(),
      hours: Number(row.hours), entries: safeJson(row.entries, []),
    };
    if (!record.teacherId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record.month) || !Number.isFinite(record.hours)) throw new Error(`Invalid payroll row ${index + 2}`);
    return record as MonthlyRecord;
  });
};

const download = (content: BlobPart, type: string, filename: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
};

export const exportExcel = async (data: PayrollData) => {
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.utils.book_new();
  (["teachers", "activities", "records"] as Dataset[]).forEach((dataset) => {
    const rows = serialize(dataset, data);
    const headers = Object.keys(rows[0] ?? (dataset === "teachers" ? { id: "", code: "", name: "", type: "", hourlyRate: "", rates: "" } : dataset === "activities" ? { id: "", name: "", kind: "", schoolId: "" } : { teacherId: "", month: "", hours: "", entries: "" }));
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
    worksheet["!autofilter"] = { ref: `A1:${XLSX.utils.encode_col(headers.length - 1)}1` };
    worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 4) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetNames[dataset]);
  });
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  download(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `teachers-payrolls-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportCsv = async (dataset: Dataset, data: PayrollData) => {
  const { default: Papa } = await import("papaparse");
  const csv = Papa.unparse(serialize(dataset, data));
  download(`\uFEFF${csv}`, "text/csv;charset=utf-8", `${dataset}-${new Date().toISOString().slice(0, 10)}.csv`);
};

export const importSpreadsheet = async (file: File, csvDataset: Dataset): Promise<Partial<PayrollData>> => {
  if (file.name.toLowerCase().endsWith(".csv")) {
    const { default: Papa } = await import("papaparse");
    const parsed = Papa.parse<Record<string, unknown>>(await file.text().then((text) => text.replace(/^\uFEFF/, "")), { header: true, skipEmptyLines: true });
    if (parsed.errors.length) throw new Error(`Invalid CSV: ${parsed.errors[0].message}`);
    return { [csvDataset]: parseRows(csvDataset, parsed.data) };
  }
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const result: Partial<PayrollData> = {};
  (["teachers", "activities", "records"] as Dataset[]).forEach((dataset) => {
    const sheet = workbook.Sheets[sheetNames[dataset]];
    if (sheet) Object.assign(result, { [dataset]: parseRows(dataset, XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })) });
  });
  if (!Object.keys(result).length) throw new Error("The workbook needs a Teachers, Activities, or Records sheet");
  return result;
};
