# WasteID Web Prototype

Vue 3 + Vite front end, Hono API (`server/app.js`) with Drizzle ORM. Production runs on Cloudflare Pages + D1; the same API also runs on Node + SQLite (`server/node.js`).

## Local development

```bash
npm install
echo "AUTH_SECRET=$(openssl rand -hex 32)" > .dev.vars
npm run dev:api   # Node API on :8788, SQLite at .wrangler/dev.db, applies migrations automatically
npm run dev       # Vite on :5173, proxies /api to :8788
```

Sign in with `admin / admin123`. An empty database is filled with demo data on first login; "Reset demo data" restores it.

`npm run dev:cf` runs the real Cloudflare runtime locally instead (needs glibc >= 2.35).

## Ops mailbox and tickets

Emails to the ops mailbox (a cloudflare_temp_email address) become tickets: JEV (`POST /v1/systemone`) classifies them as critical / normal / low, they are assigned to the active Operations user with the fewest open tickets, and that user is emailed if they have an email address. Settings (in `.dev.vars` locally, Pages secrets in production):

| Variable | Meaning |
| --- | --- |
| `JEV_API_URL`, `JEV_MODEL`, `JEV_API_KEYS` | JEV endpoint, model (`jev-latest`), comma-separated keys (tried in turn) |
| `MAIL_API_URL` | Mail API, e.g. `https://apimail.saulxj.ggff.net` |
| `MAIL_ADDRESS_JWT` | Address JWT of the ops mailbox (admin panel → address → credential) |
| `MAIL_POLL_MINUTES` | Node server poll interval, `0` disables (default 5) |
| `CRON_SECRET` | Shared secret for `POST /api/mailbox/poll` from the cron Worker |

`npm run dev:api` polls the mailbox itself. Cloudflare Pages has no cron, so deploy the small Worker in `cron/` (set `APP_URL` in `cron/wrangler.toml`, then `npx wrangler secret put CRON_SECRET --config cron/wrangler.toml` and `npx wrangler deploy --config cron/wrangler.toml`). Sending notifications uses the mailbox's send balance (set it in the mail admin panel → sender access).

## Schema changes

Edit `server/schema.js`, then `npm run db:generate` and commit the new file in `migrations/`.

## Cloudflare deployment (GitHub auto-deploy)

One-time setup:

1. `npx wrangler login`
2. `npx wrangler d1 create wasteid` and put the printed `database_id` into `wrangler.toml`.
3. `npm run db:migrate:remote` creates the tables and the admin user.
4. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git, pick the repo.
   Build command `npm run build`, output `dist`, env var `NODE_VERSION=22`.
5. Pages project → Settings → Variables and Secrets: add secret `AUTH_SECRET` (random 64 hex chars) for Production and Preview.

After that every push to `main` deploys. When a commit adds migrations, run `npm run db:migrate:remote` before or right after pushing.

## Moving to a dedicated server

Run `server/node.js` (or a copy pointing at another drizzle driver). For PostgreSQL: switch `server/schema.js` to `pg-core` (`sqliteTable` → `pgTable`, `real` → `doublePrecision`, json text → `jsonb`), replace `db.batch` with `db.transaction`, replace `rowid` ordering with a serial/created_at column, and export the D1 data with `wrangler d1 export wasteid --remote --output dump.sql`.

## Known prototype limits

- Clients load all data at start and sync changed rows; concurrent edits to the same record are last-write-wins.
- IDs are generated in the browser (`nextId`); two users creating records at the same moment can collide.
- Only one role (authority admin); no per-hauler data isolation yet.
