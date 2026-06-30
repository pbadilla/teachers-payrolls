# Teachers Payrolls

## Local development

Copy `server/.env.example` to `server/.env`, configure MongoDB Atlas, then run:

```bash
pnpm install
pnpm run dev
```

## Vercel deployment

Import this repository into Vercel and configure these project environment variables:

- `MONGODB_URI`: the private MongoDB Atlas connection string
- `MONGODB_DB`: `rg360_payrolls`
- `CLIENT_ORIGIN`: the final HTTPS application origin

Do not upload `server/.env`. Vercel builds the Vite frontend and exposes the Fastify API under `/api/*`.
