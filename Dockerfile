# API only: the frontend is deployed separately (Cloudflare).
FROM oven/bun:1.4-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY server ./server
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["bun", "server/index.mjs"]
