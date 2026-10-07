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
  build variables `VITE_API_URL=https://nominas-api.rollergrind360.com/api` and
  `VITE_PLAYOFF_API_URL` (the club API from new-playoff, whose weekly agenda is shown in the Calendari grid). It is served at
  `https://tools.rollergrind360.com/nominas`.

Do not upload `server/.env`.

## Loading the attendance Excel

`scripts/import-calendar.ts` loads a "calendario" workbook (one sheet per month) into the Calendari
tab and creates the teachers of its "Profes" tables that don't exist yet. It does a dry run unless
`--write` is passed, and does not touch the payrolls ("Aplicar a la nòmina" does):

```bash
bun scripts/import-calendar.ts "calendario 2026.xlsx" --year 2026 --alias Maty=Matias --write
```

