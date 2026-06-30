import app from "../server/index.mjs";

export default async function handler(request, response) {
  await app.ready();
  app.server.emit("request", request, response);
  await new Promise(resolve => response.once("finish", resolve));
}
