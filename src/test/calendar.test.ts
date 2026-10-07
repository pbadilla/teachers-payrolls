import * as XLSX from "@e965/xlsx";
import { describe, expect, it } from "vitest";
import { calendarPayroll, countSessions, matchName, monthWeeks, normalizeDay } from "@/lib/calendar";
import { analyzeCalendarImport, buildCalendarImport, parseCalendarWorkbook } from "@/lib/calendar-import";
import { recordPayment, type Teacher } from "@/types/teacher";

const teacher = (id: string, name: string, hourlyRate = 25, type: Teacher["type"] = "coded"): Teacher => ({ id, code: "", name, type, hourlyRate });

// Excel date serial of a day (1900 system).
const serial = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000 + 25_569;

/** A sheet shaped like the "calendario" Excel: title, a week of dates, a main and a blue row, and the "Profes" table. */
function octoberWorkbook() {
  const sheet: XLSX.WorkSheet = {};
  const set = (address: string, cell: XLSX.CellObject) => { sheet[address] = cell; };
  set("B1", { t: "s", v: "Octubre 2026" });
  ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]
    .forEach((date, index) => set(XLSX.utils.encode_cell({ r: 2, c: index + 1 }), { t: "n", v: serial(date) }));
  set("B4", { t: "s", v: "Festiu :(" }); // 28 Sep, typed in the October sheet
  set("E4", { t: "s", v: "Mario Raúl LauraM Maty" }); // 1 Oct
  set("E5", { t: "s", v: "Mario" }); // blue row
  set("F4", { t: "s", v: "Raúl i Nil" }); // 2 Oct
  set("D20", { t: "s", v: "Profes" });
  const person = (row: number, name: string, count: number, pay: number | undefined, countFormula: string, payFormula?: string, left?: string) => {
    if (left) set(`C${row}`, { t: "s", v: left });
    set(`D${row}`, { t: "s", v: name });
    set(`E${row}`, { t: "n", v: count, f: countFormula });
    if (pay !== undefined) set(`F${row}`, { t: "n", v: pay, ...(payFormula ? { f: payFormula } : {}) });
  };
  person(21, "Mario", 2, 40, 'COUNTIF(B4:H6,"*mario*")', "E21*20");
  person(22, "Raúl", 2, 22, 'COUNTIF(B4:H6,"*Raúl*")', "E22*25-28");
  person(23, "Laura M.", 1, 25, 'COUNTIF(B4:H6,"*LauraM*")', "E23*25");
  person(24, "Nil", 1, 18, 'COUNTIF(B4:H6,"*Nil*")', "E24*18", "efectiu");
  person(25, "Estel", 0, 300, 'COUNTIF(B4:H6,"*estel*")');
  set("D26", { t: "s", v: "Seguretat social" });
  set("F26", { t: "n", v: 900 });
  set("D27", { t: "s", v: "TOTALS" });
  sheet["!ref"] = "A1:H27";
  return { SheetNames: ["Octubre"], Sheets: { Octubre: sheet } } as XLSX.WorkBook;
}

describe("calendar", () => {
  it("lays out the month in Monday–Sunday weeks", () => {
    const weeks = monthWeeks("2026-10");
    expect(weeks[0][0]).toBe("2026-09-28");
    expect(weeks.at(-1)?.at(-1)).toBe("2026-11-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("counts one session per row where a teacher appears", () => {
    const counts = countSessions({ days: { "2026-10-01": { main: ["a", "b"], extra: ["a"] }, "2026-10-02": { main: ["a"], extra: [] } } });
    expect(counts.get("a")).toBe(3);
    expect(counts.get("b")).toBe(1);
  });

  it("counts one session per activity, plus the Excel rows without an activity", () => {
    const counts = countSessions({ days: {
      "2026-10-05": { main: ["c"], extra: [], assignments: [{ activityId: "thau", teacherIds: ["a", "b"] }, { activityId: "casas", teacherIds: ["a"] }] },
    } });
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 1, c: 1 });
  });

  it("converts days saved with an activity per teacher into activities with their teachers", () => {
    const day = normalizeDay({ main: ["a", "b"], extra: ["a"], mainActivities: { a: "thau" }, extraActivities: { a: "casas" } });
    expect(day).toEqual({ main: ["b"], extra: [], assignments: [{ activityId: "thau", teacherIds: ["a"] }, { activityId: "casas", teacherIds: ["a"] }] });
    expect(Object.fromEntries(countSessions({ days: { d: day } }))).toEqual({ a: 2, b: 1 });
  });

  it("matches names ignoring accents and by unambiguous prefix", () => {
    const candidates = [{ key: "1", name: "Raül" }, { key: "2", name: "Matias" }, { key: "3", name: "Pau" }, { key: "4", name: "Paula" }];
    expect(matchName("Raúl", candidates)?.key).toBe("1");
    expect(matchName("Mati", candidates)?.key).toBe("2");
    expect(matchName("pau", candidates)?.key).toBe("3");
    expect(matchName("Festiu", candidates)).toBeUndefined();
  });

  it("adds the month's rate and adjustment to the payroll", () => {
    const mario = teacher("m", "Mario");
    expect(recordPayment({ teacherId: "m", month: "2026-10", hours: 2, hourlyRate: 20, adjustment: -5 }, mario)).toBe(35);
    expect(recordPayment({ teacherId: "m", month: "2026-10", hours: 2 }, mario)).toBe(50);
  });
});

describe("calendar Excel import", () => {
  const months = parseCalendarWorkbook(octoberWorkbook(), XLSX.utils);
  const teachers = [teacher("m", "Mario"), teacher("r", "Raül"), teacher("e", "Estel"), teacher("x", "Matias", 15, "efectiu")];

  it("reads the grid, including days of the neighbouring month typed in the sheet", () => {
    expect(months).toHaveLength(1);
    expect(months[0].month).toBe("2026-10");
    expect(months[0].days["2026-10-01"]).toEqual({ main: "Mario Raúl LauraM Maty", extra: "Mario" });
    expect(months[0].days["2026-09-28"]).toEqual({ main: "Festiu :(", extra: "" });
    expect(months[0].socialSecurity).toBe(900);
  });

  it("reads the teachers table with rate, payment type and COUNTIF alias", () => {
    expect(months[0].people.map((person) => [person.name, person.rate, person.type, person.alias])).toEqual([
      ["Mario", 20, "coded", "mario"],
      ["Raúl", 25, "coded", "Raúl"],
      ["Laura M.", 25, "coded", "LauraM"],
      ["Nil", 18, "efectiu", "Nil"],
      ["Estel", undefined, "coded", "estel"],
    ]);
  });

  it("proposes new teachers and asks about unknown names", () => {
    const analysis = analyzeCalendarImport(months, teachers);
    expect(analysis.newPeople.map((person) => person.name)).toEqual(["Laura M.", "Nil"]);
    expect(analysis.unknownNames.map((item) => item.name).sort()).toEqual(["Festiu", "Maty"]);
  });

  it("builds the month so the payroll matches the Excel's amounts", () => {
    const analysis = analyzeCalendarImport(months, teachers);
    const result = buildCalendarImport(months, teachers, { people: analysis.newPeople, names: [], aliases: { Maty: "Matias" } });
    const all = [...teachers, ...result.teachers];
    const october = result.months[0];
    expect(result.teachers.map((item) => [item.name, item.hourlyRate, item.type])).toEqual([["Laura M.", 25, "coded"], ["Nil", 18, "efectiu"]]);
    expect(october.days["2026-09-28"]).toEqual({ main: [], extra: [], note: "Festiu :(" });
    expect(october.days["2026-10-01"].main).toContain("x"); // "Maty" → Matias
    const pay = Object.fromEntries(calendarPayroll(october, all).map((row) => [row.teacher.name, row.pay]));
    expect(pay).toEqual({ Estel: 300, "Laura M.": 25, Mario: 40, Matias: 15, Nil: 18, "Raül": 22 });
  });

  it("puts the second (blue) row in the given activity", () => {
    const result = buildCalendarImport(months, teachers, { people: [], names: [], aliases: {}, extraActivityId: "particulars" });
    expect(result.months[0].days["2026-10-01"]).toMatchObject({ extra: [], assignments: [{ activityId: "particulars", teacherIds: ["m"] }] });
  });
});
