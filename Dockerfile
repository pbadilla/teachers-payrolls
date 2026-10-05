# Frontend + API in one container: Fastify serves /api and the built SPA.
FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG BASE_PATH=/
RUN bun run build

FROM oven/bun:1.4-slim
WORKDIR /app
ENV NODE_ENV=production SERVE_STATIC=true PORT=3000
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./server
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["bun", "server/index.mjs"]
