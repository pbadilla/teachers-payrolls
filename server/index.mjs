import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const { MONGODB_URI, MONGODB_DB = "teachers_payrolls", PORT = "3004" } = process.env;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Copy server/.env.example to server/.env and configure it.");
}

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: (process.env.CLIENT_ORIGIN ?? "http://localhost:3003").split(","),
});

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db(MONGODB_DB);
const teachers = db.collection("teachers");
const records = db.collection("monthlyRecords");
const activities = db.collection("activities");
const payrollMonths = db.collection("payrollMonths");
const calendarMonths = db.collection("calendarMonths");

await Promise.all([
  teachers.createIndex({ id: 1 }, { unique: true }),
  records.createIndex({ teacherId: 1, month: 1 }, { unique: true }),
  activities.createIndex({ id: 1 }, { unique: true }),
  payrollMonths.createIndex({ month: 1 }, { unique: true }),
  calendarMonths.createIndex({ month: 1 }, { unique: true }),
]);

const withoutMongoId = { projection: { _id: 0 } };
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const optionalAmount = (value) => (value === undefined || value === null || value === "" ? undefined : Number(value));

// A month of the attendance calendar (the "calendario" Excel): who worked each day, plus the
// month's extra figures. Teachers are stored by id in a main row and a second (blue) row.
// Days of the previous/next month shown in the month's Monday–Sunday grid also belong to it when
// they are filled there (the Excel pays 30 November in December when it is typed in that sheet).
const inMonthGrid = (month, date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, monthNumber] = month.split("-").map(Number);
  const day = Date.parse(`${date}T00:00:00Z`);
  const first = Date.UTC(year, monthNumber - 1, 1);
  const last = Date.UTC(year, monthNumber, 0);
  const week = 7 * 86_400_000;
  return Number.isFinite(day) && day > first - week && day < last + week;
};

const DAY_INCIDENTS = ["rain", "open-day", "holiday"];

const sanitizeCalendarMonth = (month, body) => {
  const days = {};
  for (const [date, day] of Object.entries(body?.days ?? {})) {
    if (!inMonthGrid(month, date)) return null;
    const ids = (value) => (Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === "string" && id))] : []);
    const main = ids(day?.main);
    const extra = ids(day?.extra);
    const note = typeof day?.note === "string" ? day.note.trim() : "";
    const incidents = Array.isArray(day?.incidents) ? [...new Set(day.incidents.filter((item) => DAY_INCIDENTS.includes(item)))] : [];
    // Teachers of each activity that day; activities without teachers are dropped.
    const assignments = [];
    for (const assignment of Array.isArray(day?.assignments) ? day.assignments : []) {
      const teacherIds = ids(assignment?.teacherIds);
      if (typeof assignment?.activityId !== "string" || !assignment.activityId || !teacherIds.length) continue;
      const existing = assignments.find((item) => item.activityId === assignment.activityId);
      if (existing) existing.teacherIds = [...new Set([...existing.teacherIds, ...teacherIds])];
      else assignments.push({ activityId: assignment.activityId, teacherIds });
    }
    if (main.length || extra.length || note || incidents.length || assignments.length) {
      days[date] = { main, extra, ...(note ? { note } : {}), ...(incidents.length ? { incidents } : {}), ...(assignments.length ? { assignments } : {}) };
    }
  }
  // Per-teacher rate and adjustment of the month, keyed by teacher id.
  const byTeacher = {};
  for (const key of ["rates", "adjustments"]) {
    const entries = Object.entries(body?.[key] ?? {}).map(([id, value]) => [id, Number(value)]);
    if (entries.some(([, value]) => !Number.isFinite(value))) return null;
    if (entries.length) byTeacher[key] = Object.fromEntries(entries);
  }
  const amounts = {};
  for (const key of ["socialSecurity", "schoolIncome", "shopIncome"]) {
    const value = optionalAmount(body?.[key]);
    if (value === undefined) continue;
    if (!Number.isFinite(value)) return null;
    amounts[key] = value;
  }
  return { month, days, ...byTeacher, ...amounts };
};

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/data", async () => ({
  teachers: await teachers.find({}, withoutMongoId).sort({ name: 1 }).toArray(),
  records: await records.find({}, withoutMongoId).toArray(),
  activities: await activities.find({}, withoutMongoId).sort({ name: 1 }).toArray(),
  payrollMonths: await payrollMonths.find({}, withoutMongoId).toArray(),
}));

app.post("/api/activities", async (request, reply) => { await activities.insertOne(request.body); return reply.code(201).send(request.body); });
// Tabs of "Activitats / Escoles" a school card can belong to.
const SCHOOL_SECTIONS = ["schools", "particulars", "casals", "events"];

app.put("/api/activities/:id", async (request, reply) => {
  const { id } = request.params;
  const activity = await activities.findOne({ id }, withoutMongoId);
  if (!activity) return reply.code(404).send({ error: "Activity or school not found" });
  const body = request.body ?? {};
  const name = typeof body.name === "string" ? body.name.trim() : activity.name;
  const teacherIds = body.teacherIds;
  const invalidNumber = (value, min, max) => value !== undefined && value !== null && (!Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max);
  if (!name || (teacherIds !== undefined && (!Array.isArray(teacherIds) || teacherIds.some((teacherId) => typeof teacherId !== "string")))
    || invalidNumber(body.weekDay, 1, 7) || invalidNumber(body.places, 0, 100_000)
    || (body.section !== undefined && !SCHOOL_SECTIONS.includes(body.section))) {
    return reply.code(400).send({ error: "name must be text, teacherIds a list, weekDay 1–7, places a whole number and section one of " + SCHOOL_SECTIONS.join(", ") });
  }
  const updated = {
    ...activity,
    name,
    ...(teacherIds !== undefined ? { teacherIds: [...new Set(teacherIds)] } : {}),
    ...(body.section !== undefined ? { section: body.section } : {}),
  };
  // weekDay and places: a number sets them, null removes them, absent keeps them.
  for (const key of ["weekDay", "places"]) {
    if (body[key] === null) delete updated[key];
    else if (body[key] !== undefined) updated[key] = Number(body[key]);
  }
  await activities.replaceOne({ id }, updated);
  return updated;
});

app.delete("/api/activities/:id", async (request, reply) => {
  const { id } = request.params;
  const activity = await activities.findOne({ id }, withoutMongoId);
  if (!activity) return reply.code(404).send({ error: "Activity or school not found" });
  if (activity.kind === "school" && await activities.findOne({ schoolId: id })) {
    return reply.code(409).send({ error: "This school still has activities" });
  }
  if (await teachers.findOne({ "rates.activityId": id }) || await records.findOne({ "entries.activityId": id })) {
    return reply.code(409).send({ error: "This activity is used by a teacher or payroll" });
  }
  await activities.deleteOne({ id });
  return reply.code(204).send();
});

app.put("/api/payroll-months/:month", async (request, reply) => {
  const { month } = request.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return reply.code(400).send({ error: "Invalid month" });
  const status = request.body?.status === "paid" ? "paid" : "pending";
  const state = { month, status, locked: Boolean(request.body?.locked) };
  await payrollMonths.replaceOne({ month }, state, { upsert: true });
  return state;
});

app.post("/api/payroll-months/copy", async (request, reply) => {
  const { sourceMonth, targetMonth, overwrite = false } = request.body ?? {};
  const validMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "");
  if (!validMonth(sourceMonth) || !validMonth(targetMonth) || sourceMonth === targetMonth) {
    return reply.code(400).send({ error: "Source and target months must be different valid months" });
  }
  if ((await payrollMonths.findOne({ month: targetMonth }))?.locked) {
    return reply.code(423).send({ error: "The target payroll is locked" });
  }
  const source = await records.find({ month: sourceMonth }, withoutMongoId).toArray();
  if (!source.length) return reply.code(404).send({ error: "The source payroll has no records" });
  if (!overwrite && await records.findOne({ month: targetMonth })) {
    return reply.code(409).send({ error: "The target payroll already contains records" });
  }
  if (overwrite) await records.deleteMany({ month: targetMonth });
  const copies = source.map(({ month, ...record }) => ({ ...record, month: targetMonth }));
  await records.insertMany(copies);
  await payrollMonths.updateOne(
    { month: targetMonth },
    { $setOnInsert: { month: targetMonth, status: "pending", locked: false } },
    { upsert: true },
  );
  return reply.code(201).send({ copied: copies.length });
});

app.get("/api/calendar/:month", async (request, reply) => {
  const { month } = request.params;
  if (!MONTH_PATTERN.test(month)) return reply.code(400).send({ error: "Invalid month" });
  return (await calendarMonths.findOne({ month }, withoutMongoId)) ?? { month, days: {} };
});

app.put("/api/calendar/:month", async (request, reply) => {
  const { month } = request.params;
  if (!MONTH_PATTERN.test(month)) return reply.code(400).send({ error: "Invalid month" });
  const calendar = sanitizeCalendarMonth(month, request.body);
  if (!calendar) return reply.code(400).send({ error: "The calendar contains invalid days or amounts" });
  await calendarMonths.replaceOne({ month }, calendar, { upsert: true });
  return calendar;
});

app.delete("/api/calendar/:month", async (request, reply) => {
  const { month } = request.params;
  if (!MONTH_PATTERN.test(month)) return reply.code(400).send({ error: "Invalid month" });
  const result = await calendarMonths.deleteOne({ month });
  return { deleted: result.deletedCount };
});

// Removes a month's payroll: its records and its state (paid, locked). A locked month is refused.
app.delete("/api/records/:month", async (request, reply) => {
  const { month } = request.params;
  if (!MONTH_PATTERN.test(month)) return reply.code(400).send({ error: "Invalid month" });
  if ((await payrollMonths.findOne({ month }))?.locked) return reply.code(423).send({ error: "This payroll is locked" });
  const [removed] = await Promise.all([records.deleteMany({ month }), payrollMonths.deleteOne({ month })]);
  return { deleted: removed.deletedCount };
});

// Writes the hours counted in the calendar to the month's payroll in one go.
app.put("/api/records/:month", async (request, reply) => {
  const { month } = request.params;
  if (!MONTH_PATTERN.test(month)) return reply.code(400).send({ error: "Invalid month" });
  if ((await payrollMonths.findOne({ month }))?.locked) return reply.code(423).send({ error: "This payroll is locked" });
  const rows = Array.isArray(request.body?.records) ? request.body.records : [];
  const invalidAmount = (value) => value !== undefined && !Number.isFinite(Number(value));
  if (!rows.length || rows.some((row) => !row?.teacherId || !Number.isFinite(Number(row?.hours)) || invalidAmount(row.hourlyRate) || invalidAmount(row.adjustment))) {
    return reply.code(400).send({ error: "records must be a non-empty list of { teacherId, hours, hourlyRate?, adjustment? }" });
  }
  await records.bulkWrite(rows.map((row) => ({
    replaceOne: {
      filter: { teacherId: row.teacherId, month },
      replacement: {
        teacherId: row.teacherId,
        month,
        hours: Number(row.hours),
        ...(row.hourlyRate !== undefined ? { hourlyRate: Number(row.hourlyRate) } : {}),
        ...(row.adjustment ? { adjustment: Number(row.adjustment) } : {}),
      },
      upsert: true,
    },
  })));
  return { updated: rows.length };
});

app.post("/api/seed", async (request, reply) => {
  const body = request.body ?? {};
  if (!Array.isArray(body.teachers) || !Array.isArray(body.records)) {
    return reply.code(400).send({ error: "teachers and records must be arrays" });
  }

  if ((await teachers.estimatedDocumentCount()) === 0 && body.teachers.length) {
    await teachers.insertMany(body.teachers);
  }
  if ((await records.estimatedDocumentCount()) === 0 && body.records.length) {
    await records.insertMany(body.records);
  }
  return reply.code(201).send({ ok: true });
});

app.post("/api/import", async (request, reply) => {
  const body = request.body ?? {};
  const importedTeachers = Array.isArray(body.teachers) ? body.teachers : [];
  const importedRecords = Array.isArray(body.records) ? body.records : [];
  const importedActivities = Array.isArray(body.activities) ? body.activities : [];

  if (!importedTeachers.length && !importedRecords.length && !importedActivities.length) {
    return reply.code(400).send({ error: "The import does not contain any supported rows" });
  }

  const invalidTeacher = importedTeachers.find((teacher) => !teacher?.id || !teacher?.name || !["coded", "efectiu"].includes(teacher?.type) || !Number.isFinite(Number(teacher?.hourlyRate)));
  const invalidActivity = importedActivities.find((activity) => !activity?.id || !activity?.name);
  const invalidRecord = importedRecords.find((record) => !record?.teacherId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(record?.month ?? "") || !Number.isFinite(Number(record?.hours)));
  if (invalidTeacher || invalidActivity || invalidRecord) {
    return reply.code(400).send({ error: "The import contains invalid or incomplete rows" });
  }

  const operations = [];
  if (importedTeachers.length) operations.push(teachers.bulkWrite(importedTeachers.map(({ _id, ...teacher }) => ({
    replaceOne: { filter: { id: teacher.id }, replacement: { ...teacher, hourlyRate: Number(teacher.hourlyRate) }, upsert: true },
  }))));
  if (importedActivities.length) operations.push(activities.bulkWrite(importedActivities.map(({ _id, ...activity }) => ({
    replaceOne: { filter: { id: activity.id }, replacement: activity, upsert: true },
  }))));
  if (importedRecords.length) operations.push(records.bulkWrite(importedRecords.map(({ _id, ...record }) => ({
    replaceOne: { filter: { teacherId: record.teacherId, month: record.month }, replacement: {
      ...record,
      hours: Number(record.hours),
      ...(record.hourlyRate !== undefined ? { hourlyRate: Number(record.hourlyRate) } : {}),
      ...(record.adjustment !== undefined ? { adjustment: Number(record.adjustment) } : {}),
    }, upsert: true },
  }))));
  await Promise.all(operations);

  return reply.code(201).send({ teachers: importedTeachers.length, records: importedRecords.length, activities: importedActivities.length });
});

app.post("/api/teachers", async (request, reply) => {
  const teacher = request.body;
  await teachers.insertOne(teacher);
  return reply.code(201).send(teacher);
});

app.put("/api/teachers/:id", async (request, reply) => {
  const { id } = request.params;
  const teacher = { ...request.body, id };
  delete teacher._id;
  const result = await teachers.replaceOne({ id }, teacher);
  if (!result.matchedCount) return reply.code(404).send({ error: "Teacher not found" });
  return teacher;
});

app.delete("/api/teachers/:id", async (request, reply) => {
  const { id } = request.params;
  await Promise.all([
    teachers.deleteOne({ id }),
    records.deleteMany({ teacherId: id }),
    activities.updateMany({ teacherIds: id }, { $pull: { teacherIds: id } }),
  ]);
  return reply.code(204).send();
});

app.put("/api/records/:teacherId/:month", async (request) => {
  const { teacherId, month } = request.params;
  if ((await payrollMonths.findOne({ month }))?.locked) {
    const error = new Error("This payroll is locked");
    error.statusCode = 423;
    throw error;
  }
  const entries = Array.isArray(request.body?.entries) ? request.body.entries : undefined;
  // Editing the hours keeps the month's rate and adjustment that came from the calendar.
  const previous = await records.findOne({ teacherId, month }, withoutMongoId);
  const record = {
    teacherId,
    month,
    hours: entries ? entries.reduce((s, e) => s + Number(e.hours), 0) : Number(request.body?.hours ?? 0),
    ...(entries ? { entries } : {}),
    ...(previous?.hourlyRate !== undefined ? { hourlyRate: previous.hourlyRate } : {}),
    ...(previous?.adjustment ? { adjustment: previous.adjustment } : {}),
  };
  await records.replaceOne({ teacherId, month }, record, { upsert: true });
  return record;
});

app.addHook("onClose", async () => client.close());

const shutdown = async () => app.close();
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await app.listen({ port: Number(PORT), host: "0.0.0.0" });
