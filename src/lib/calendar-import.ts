import type { CellObject, WorkBook, WorkSheet } from "@e965/xlsx";
import type { CalendarDay, CalendarMonth } from "@/types/calendar";
import type { Teacher } from "@/types/teacher";
import { cellTokens, countSessions, matchName, type NameCandidate, normalizeName } from "@/lib/calendar";
import { createId } from "@/lib/id";

// Reads the "calendario" workbook: one sheet per month titled "Octubre 2026", a Monday–Sunday grid
// where each week is a row of dates followed by a main row and a second (blue) row of names, and a
// "Profes" table with each teacher's count (COUNTIF formula) and pay (count × rate).

const MONTH_NAMES = [
  ["enero", "gener", "january"], ["febrero", "febrer", "february"], ["marzo", "marc", "march"],
  ["abril", "april"], ["mayo", "maig", "may"], ["junio", "juny", "june"], ["julio", "juliol", "july"],
  ["agosto", "agost", "august"], ["septiembre", "setembre", "september"], ["octubre", "october"],
  ["noviembre", "novembre", "november"], ["diciembre", "desembre", "december"],
];

export interface SheetPerson {
  name: string;
  type: Teacher["type"];
  code: string;
  /** Sessions counted by the Excel. */
  count: number;
  /** Amount paid in the Excel (count × rate, sometimes with a manual adjustment or a fixed amount). */
  pay?: number;
  /** Rate of the pay formula ("E30*20" → 20). */
  rate?: number;
  /** Pattern of the COUNTIF formula ("*LauraM*" → "LauraM"). */
  alias?: string;
}

export interface SheetMonth {
  sheet: string;
  month: string;
  days: Record<string, { main: string; extra: string }>;
  people: SheetPerson[];
  socialSecurity?: number;
  schoolIncome?: number;
  shopIncome?: number;
}

const pad = (value: number) => String(value).padStart(2, "0");
const text = (cell?: CellObject) => (cell?.t === "s" ? String(cell.v).trim() : "");
const num = (cell?: CellObject) => (cell?.t === "n" && Number.isFinite(cell.v) ? Number(cell.v) : undefined);

/** Excel date serial (1900 system) to "YYYY-MM-DD". */
const serialToDate = (serial: number) => {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

const isPersonName = (value: string) => Boolean(value) && !/^ES\d{2}/i.test(value) && normalizeName(value) !== "efectiu";
const isDateSerial = (cell?: CellObject) => cell?.t === "n" && Number(cell.v) > 36_000 && Number(cell.v) < 73_000;

function sheetMonth(sheet: WorkSheet, encode: (cell: { r: number; c: number }) => string): string | undefined {
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 6; c += 1) {
      const match = text(sheet[encode({ r, c })]).match(/^([\p{L}]+)\s+(\d{4})$/u);
      if (!match) continue;
      const index = MONTH_NAMES.findIndex((names) => names.includes(normalizeName(match[1])));
      if (index >= 0) return `${match[2]}-${pad(index + 1)}`;
    }
  }
  return undefined;
}

export function parseCalendarWorkbook(
  workbook: WorkBook,
  utils: { decode_range: (range: string) => { s: { r: number; c: number }; e: { r: number; c: number } }; encode_cell: (cell: { r: number; c: number }) => string },
): SheetMonth[] {
  const months: SheetMonth[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    const month = sheetMonth(sheet, utils.encode_cell);
    if (!month) continue;
    const range = utils.decode_range(sheet["!ref"]);
    const at = (r: number, c: number) => sheet[utils.encode_cell({ r, c })];
    const isDateRow = (r: number) => [1, 2, 3, 4, 5, 6, 7].some((c) => isDateSerial(at(r, c)));

    // Calendar grid: columns B–H are Monday–Sunday.
    // A day typed in this sheet counts in this sheet's month even when it falls in the previous or next
    // month (30 November written in the December sheet is paid in December), as the Excel does.
    const days: SheetMonth["days"] = {};
    let lastDateRow = range.s.r;
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      if (!isDateRow(r)) continue;
      lastDateRow = r;
      const mainRow = isDateRow(r + 1) ? undefined : r + 1;
      const extraRow = mainRow === undefined || isDateRow(r + 2) ? undefined : r + 2;
      for (let c = 1; c <= 7; c += 1) {
        const cell = at(r, c);
        if (!isDateSerial(cell)) continue;
        const date = serialToDate(Number(cell!.v));
        const main = mainRow === undefined ? "" : text(at(mainRow, c));
        const extra = extraRow === undefined ? "" : text(at(extraRow, c));
        if (main || extra) days[date] = { main, extra };
      }
    }

    // "Profes" table (below the grid): name, count (COUNTIF "*alias*") and pay (count × rate), with the
    // payment type and IBAN on the left. Its header and column change between sheets, so the name
    // column is the one whose right neighbour holds the COUNTIF formulas.
    const people: SheetPerson[] = [];
    let socialSecurity: number | undefined;
    let schoolIncome: number | undefined;
    let shopIncome: number | undefined;
    const formulaColumns = new Map<number, number>();
    for (let r = lastDateRow + 1; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const label = normalizeName(text(at(r, c)));
        if (label.startsWith("ingresoscole") || label.startsWith("ingressosescol")) schoolIncome = num(at(r, c + 1)) ?? schoolIncome;
        if (label.startsWith("ingresosbotiga") || label.startsWith("ingressosbotiga")) shopIncome = num(at(r, c + 1)) ?? shopIncome;
        if (/COUNTIF/i.test(at(r, c + 1)?.f ?? "") && text(at(r, c))) formulaColumns.set(c, (formulaColumns.get(c) ?? 0) + 1);
      }
    }
    const nameColumn = [...formulaColumns].sort((left, right) => right[1] - left[1])[0]?.[0];
    for (let r = lastDateRow + 1; nameColumn !== undefined && r <= range.e.r; r += 1) {
      const rawName = text(at(r, nameColumn));
      const key = normalizeName(rawName);
      if (!isPersonName(rawName) || ["profes", "nom", "totals", "total"].includes(key)) continue;
      const pay = at(r, nameColumn + 2);
      if (key.startsWith("seguretatsocial") || key.startsWith("seguridadsocial")) { socialSecurity = num(pay) ?? socialSecurity; continue; }
      const countCell = at(r, nameColumn + 1);
      if (num(countCell) === undefined && num(pay) === undefined) continue;
      const left = Array.from({ length: nameColumn }, (_, column) => text(at(r, column)));
      const name = rawName.replace(/\befectiu\b/i, "").trim(); // "Alex efectiu"
      const formulaRate = pay?.f?.match(/^\s*[A-Z]+\d+\s*\*\s*([\d.]+)/i)?.[1];
      people.push({
        name,
        type: name !== rawName || left.some((value) => normalizeName(value) === "efectiu") ? "efectiu" : "coded",
        code: left.find((value) => /^ES\d{2}/i.test(value)) ?? "",
        count: num(countCell) ?? 0,
        pay: num(pay),
        rate: formulaRate ? Number(formulaRate) : undefined,
        alias: countCell?.f?.match(/"\*([^*"]+)\*"/)?.[1],
      });
    }

    months.push({ sheet: sheetName, month, days, people, socialSecurity, schoolIncome, shopIncome });
  }
  return months;
}

export interface ImportAnalysis {
  /** People of the "Profes" tables who are not teachers yet. */
  newPeople: SheetPerson[];
  /** Names in the calendar that match neither a teacher nor someone of the "Profes" tables. */
  unknownNames: { name: string; count: number }[];
}

/** Aliases from the COUNTIF patterns, dropped when they are someone else's name (the Excel had "Adri" counting "*Pau*"). */
function peopleWithAliases(months: SheetMonth[]) {
  const people = new Map<string, SheetPerson>();
  for (const month of [...months].sort((left, right) => left.month.localeCompare(right.month))) {
    for (const person of month.people) people.set(normalizeName(person.name), person);
  }
  const names = new Set([...people.values()].flatMap((person) => [normalizeName(person.name), normalizeName(person.name.split(/[\s(]/)[0])]));
  return [...people.values()].map((person) => {
    const alias = person.alias && normalizeName(person.alias);
    const ownName = normalizeName(person.name.split(/[\s(]/)[0]);
    return { ...person, alias: alias && (alias === ownName || !names.has(alias)) ? person.alias : undefined };
  });
}

const teacherCandidates = (teachers: Teacher[], people: SheetPerson[]): NameCandidate[] =>
  teachers.map((teacher) => ({
    key: teacher.id,
    name: teacher.name,
    aliases: people.filter((person) => person.alias && matchName(person.name, [{ key: teacher.id, name: teacher.name }])).map((person) => person.alias!),
  }));

export function analyzeCalendarImport(months: SheetMonth[], teachers: Teacher[]): ImportAnalysis {
  const people = peopleWithAliases(months);
  const existing = teacherCandidates(teachers, people);
  const newPeople = people.filter((person) => !matchName(person.name, existing));
  const candidates = [...existing, ...newPeople.map((person) => ({ key: person.name, name: person.name, aliases: person.alias ? [person.alias] : [] }))];
  const unknown = new Map<string, { name: string; count: number }>();
  for (const month of months) {
    for (const day of Object.values(month.days)) {
      for (const token of [...cellTokens(day.main), ...cellTokens(day.extra)]) {
        if (matchName(token, candidates)) continue;
        const key = normalizeName(token);
        const entry = unknown.get(key) ?? { name: token, count: 0 };
        entry.count += 1;
        unknown.set(key, entry);
      }
    }
  }
  return { newPeople, unknownNames: [...unknown.values()].sort((left, right) => right.count - left.count) };
}

export interface ImportChoices {
  /** People of the "Profes" tables to create as teachers. */
  people: SheetPerson[];
  /** Unknown calendar names to create as teachers. */
  names: string[];
  /** Unknown calendar names that are another spelling of a teacher ("Maty" → "Matias"). */
  aliases: Record<string, string>;
  /** Activity the teachers of the second (blue) row did ("Particulars"); without it they stay in `extra`. */
  extraActivityId?: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Builds the calendar months and the teachers to create. Each month keeps the Excel's rate per
 * teacher and, when the Excel paid something else than count × rate (a fixed amount, an advance),
 * the difference as an adjustment. Names that stay unmatched become the day's note.
 */
export function buildCalendarImport(
  months: SheetMonth[],
  teachers: Teacher[],
  choices: ImportChoices,
): { teachers: Teacher[]; months: CalendarMonth[] } {
  const people = peopleWithAliases(months);
  const newTeachers: Teacher[] = [
    ...choices.people.map((person) => ({ id: createId(), code: person.code, name: person.name, type: person.type, hourlyRate: person.rate ?? 25, rates: [] })),
    ...choices.names.map((name) => ({ id: createId(), code: "", name, type: "coded" as const, hourlyRate: 25, rates: [] })),
  ];
  const allTeachers = [...teachers, ...newTeachers];
  const candidates = teacherCandidates(allTeachers, people).map((candidate) => ({
    ...candidate,
    aliases: [
      ...(candidate.aliases ?? []),
      ...Object.entries(choices.aliases).filter(([, name]) => name === candidate.name).map(([alias]) => alias),
    ],
  }));

  const resolveCell = (cell: string) => {
    const ids: string[] = [];
    const unmatched: string[] = [];
    for (const token of cellTokens(cell)) {
      const match = matchName(token, candidates);
      if (match) { if (!ids.includes(match.key)) ids.push(match.key); } else unmatched.push(token);
    }
    return { ids, note: ids.length ? unmatched.join(" ") : cell.trim() };
  };

  return {
    teachers: newTeachers,
    months: months.map((month) => {
      const days: Record<string, CalendarDay> = {};
      for (const [date, cells] of Object.entries(month.days)) {
        const main = resolveCell(cells.main);
        const extra = resolveCell(cells.extra);
        const note = [main.note, extra.note].filter(Boolean).join(" · ");
        const toActivity = Boolean(choices.extraActivityId && extra.ids.length);
        days[date] = {
          main: main.ids,
          extra: toActivity ? [] : extra.ids,
          ...(note ? { note } : {}),
          ...(toActivity ? { assignments: [{ activityId: choices.extraActivityId!, teacherIds: extra.ids }] } : {}),
        };
      }
      const rates: Record<string, number> = {};
      const adjustments: Record<string, number> = {};
      const sessions = countSessions({ days });
      for (const person of month.people) {
        const teacher = allTeachers.find((item) => item.id === matchName(person.name, candidates)?.key);
        if (!teacher || person.pay === undefined) continue;
        if (person.rate !== undefined && person.rate !== teacher.hourlyRate) rates[teacher.id] = person.rate;
        // "E35*25-28": the -28 is an adjustment. A typed amount (a fixed salary) is kept as it is:
        // the adjustment is whatever the calendar's sessions don't cover.
        const adjustment = person.rate !== undefined
          ? round2(person.pay - person.count * person.rate)
          : round2(person.pay - (sessions.get(teacher.id) ?? 0) * teacher.hourlyRate);
        if (adjustment) adjustments[teacher.id] = adjustment;
      }
      return {
        month: month.month,
        days,
        ...(Object.keys(rates).length ? { rates } : {}),
        ...(Object.keys(adjustments).length ? { adjustments } : {}),
        ...(month.socialSecurity !== undefined ? { socialSecurity: month.socialSecurity } : {}),
        ...(month.schoolIncome !== undefined ? { schoolIncome: month.schoolIncome } : {}),
        ...(month.shopIncome !== undefined ? { shopIncome: month.shopIncome } : {}),
      };
    }),
  };
}
