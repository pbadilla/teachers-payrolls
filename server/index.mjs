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

await Promise.all([
  teachers.createIndex({ id: 1 }, { unique: true }),
  records.createIndex({ teacherId: 1, month: 1 }, { unique: true }),
  activities.createIndex({ id: 1 }, { unique: true }),
  payrollMonths.createIndex({ month: 1 }, { unique: true }),
]);

const withoutMongoId = { projection: { _id: 0 } };

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/data", async () => ({
  teachers: await teachers.find({}, withoutMongoId).sort({ name: 1 }).toArray(),
  records: await records.find({}, withoutMongoId).toArray(),
  activities: await activities.find({}, withoutMongoId).sort({ name: 1 }).toArray(),
  payrollMonths: await payrollMonths.find({}, withoutMongoId).toArray(),
}));

app.post("/api/activities", async (request, reply) => { await activities.insertOne(request.body); return reply.code(201).send(request.body); });
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
    replaceOne: { filter: { teacherId: record.teacherId, month: record.month }, replacement: { ...record, hours: Number(record.hours) }, upsert: true },
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
  await Promise.all([teachers.deleteOne({ id }), records.deleteMany({ teacherId: id })]);
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
  const record = { teacherId, month, hours: entries ? entries.reduce((s, e) => s + Number(e.hours), 0) : Number(request.body?.hours ?? 0), ...(entries ? { entries } : {}) };
  await records.replaceOne({ teacherId, month }, record, { upsert: true });
  return record;
});

app.addHook("onClose", async () => client.close());

if (!process.env.VERCEL) {
  const shutdown = async () => app.close();
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await app.listen({ port: Number(PORT), host: "0.0.0.0" });
}

export default app;
