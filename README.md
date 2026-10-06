# Teachers Payrolls

## Local development

Copy `server/.env.example` to `server/.env`, configure MongoDB Atlas, then run:

```bash
bun install
bun run dev
```

## Deployment

- **API (Render):** create a Render *Blueprint* from this repository. `render.yaml` builds the
  Fastify API from `Dockerfile`. Set `MONGODB_URI` and `MONGODB_DB` when Render asks for them;
  `CLIENT_ORIGIN` is `https://tools.rollergrind360.com`.
- **Frontend (Cloudflare Workers):** import the repository in *Workers & Pages* with build
  command `bun install && bun run build:cloudflare`, deploy command `npx wrangler deploy` and the
  build variable `VITE_API_URL=https://nominas-api.rollergrind360.com/api`. It is served at
  `https://tools.rollergrind360.com/nominas`.

Do not upload `server/.env`.
