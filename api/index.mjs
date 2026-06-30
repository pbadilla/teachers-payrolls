import app from "../server/index.mjs";

export default async function handler(request, response) {
  const incomingUrl = new URL(request.url, "http://localhost");
  const apiPath = incomingUrl.searchParams.get("path") ?? "health";
  request.url = `/api/${apiPath}`;

  await app.ready();
  app.server.emit("request", request, response);
  await new Promise(resolve => response.once("finish", resolve));
}
