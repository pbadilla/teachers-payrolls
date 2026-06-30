import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { MongoClient } from "mongodb";

dotenv.config({ path: new URL(".env", import.meta.url) });

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

await Promise.all([
  teachers.createIndex({ id: 1 }, { unique: true }),
  records.createIndex({ teacherId: 1, month: 1 }, { unique: true }),
  activities.createIndex({ id: 1 }, { unique: true }),
]);

const withoutMongoId = { projection: { _id: 0 } };

app.get("/api/health", async () => ({ ok: true }));

app.get("/api/data", async () => ({
  teachers: await teachers.find({}, withoutMongoId).sort({ name: 1 }).toArray(),
  records: await records.find({}, withoutMongoId).toArray(),
  activities: await activities.find({}, withoutMongoId).sort({ name: 1 }).toArray(),
}));

app.post("/api/activities", async (request, reply) => { await activities.insertOne(request.body); return reply.code(201).send(request.body); });
app.delete("/api/activities/:id", async (request, reply) => { await activities.deleteOne({ id: request.params.id }); return reply.code(204).send(); });

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
