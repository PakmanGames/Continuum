# Scripts reference

Every `pnpm` command in this repo, what it actually does, and when you'd reach
for it. Package manager is **pnpm 10.x** — `npm run` will appear to work but
resolves dependencies differently, so stick to pnpm.

For deploying the app, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## First run

```bash
pnpm install                 # install dependencies
cp .env.example .env         # then fill in the values (see Environment below)
pnpm db:push                 # create the tables in your database
pnpm db:seed-historical      # demo incidents, so the app isn't empty
pnpm db:seed-heartbeats      # demo check-ins, so the fleet isn't all "stopped"
pnpm dev                     # http://localhost:3000
```

Both seeds are needed for a realistic-looking dashboard. `db:seed-historical`
creates the containers and their incident history; `db:seed-heartbeats` fills in
the check-ins that decide whether each container reads as running or down.

---

## Development

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on port 3000 with Turbopack. Reads `.env`. |
| `pnpm build` | Production build. |
| `pnpm start` | Serve an existing production build. Run `build` first. |
| `pnpm preview` | `build` then `start` — check the production bundle locally. |

> **Type and lint errors do not fail the build.** `next.config.js` sets
> `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds`, so a green
> build says nothing about type safety. Run `pnpm typecheck` yourself.

---

## Code quality

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` over the app. Should exit 0. |
| `pnpm lint` | ESLint via `next lint`. |
| `pnpm lint:fix` | ESLint with autofix. |
| `pnpm check` | `lint` + `typecheck` together — the pre-push gate. |
| `pnpm format:check` | Prettier check, no writes. |
| `pnpm format:write` | Prettier, rewriting files in place. |

`typecheck` covers the app only. The vendored submodules (`examples/`,
`original-hackathon-repo/`) are excluded in `tsconfig.json` — they're reference
copies, not part of the build.

`lint`, `build` and the `db:*` commands all load `next.config.js`, which imports
`src/env.js` and validates the environment. **Without a `POSTGRES_URL` they fail
before doing any work.** Set `SKIP_ENV_VALIDATION=1` to bypass that when you
only want to lint.

---

## Database

All of these read `POSTGRES_URL` from `.env` and act on **whatever database it
points at** — which is production if you copied the connection string from
Vercel. Check before you run a write.

| Command | What it does | Writes? |
| --- | --- | --- |
| `pnpm db:push` | Pushes `src/server/db/schema.ts` straight to the database. Fastest way to sync a dev database. | **Yes — schema** |
| `pnpm db:generate` | Writes a versioned SQL migration into `drizzle/` from schema changes. No database contact. | No |
| `pnpm db:migrate` | Applies pending migrations from `drizzle/`. | **Yes — schema** |
| `pnpm db:studio` | Opens Drizzle Studio, a browser DB client. | Manual |
| `pnpm db:seed-historical` | Seeds containers and ~90 days of incidents. | **Yes — data** |
| `pnpm db:seed-heartbeats` | Seeds container check-ins. | **Yes — data** |

Tables are prefixed `HW12_` (see `tablesFilter` in `drizzle.config.ts`), a
holdover from the original hackathon project name.

### `db:push` vs `db:generate` + `db:migrate`

`db:push` diffs your schema against the live database and applies the change
directly — no migration file, no history. Good for local iteration. Use
`db:generate` + `db:migrate` when you want the change reviewed in a PR and
replayed identically on another environment.

### The seed scripts

**`db:seed-historical`** → `src/scripts/seed-historical-incidents.ts`

Creates four containers (`worker-pool-01`, `api-gateway-01`, `db-cluster-01`,
`auth-service-02`) if they don't exist, then inserts ten incidents spread from
today back to 89 days ago. One is deliberately left unresolved so the dashboard
has an open incident to show.

> **Not idempotent.** Containers are guarded by a name check, but incidents are
> inserted unconditionally — running it twice gives you twenty incidents. To
> start over, clear `HW12_error` first.

**`db:seed-heartbeats`** → `src/scripts/seed-heartbeats.ts`

Writes 24 check-ins per container, one every 5 minutes over the last 2 hours.
`worker-pool-01` gets a `crashed` status on its most recent check-in so it lines
up with the unresolved incident from the other seed.

This one **is** re-runnable: check-ins are regenerable telemetry, so the script
clears `HW12_status` and lays down a fresh window instead of appending. Re-run
it whenever the seeded check-ins have aged enough to look stale.

> Requires containers to exist — run `db:seed-historical` first, or it exits
> with a warning.

---

## Environment

`POSTGRES_URL` is the only variable the app genuinely requires; the rest of
`src/env.js` is optional. Two Clerk keys are needed for auth but are read
directly by the Clerk SDK and **not** validated at build time, so a missing one
fails silently at runtime rather than loudly at build.

| Variable | Needed for | Validated in `src/env.js`? |
| --- | --- | --- |
| `POSTGRES_URL` | Everything. Required at build time too. | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Auth | No |
| `CLERK_SECRET_KEY` | Auth | No |
| `ELEVENLABS_API_KEY` | Voice alerts | Optional |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` / `ALERT_PHONE_NUMBER` | SMS alerts | Optional |

Running `pnpm dev` without Clerk keys drops Clerk into **keyless mode**, which
generates a throwaway instance under `.clerk/` and appends to `.gitignore`.
Harmless, but it means you aren't testing against your real Clerk app.

Empty strings count as undefined (`emptyStringAsUndefined`), so leave an
optional variable out rather than setting it blank.

---

## The agent

The Python agent in `agent/` is a separate service with its own
`requirements.txt` and `docker-compose.yml` — none of the pnpm scripts touch it.
It has its own `.env` (see `agent/.env.example`) and needs `AGENT_BACKEND_URL`
pointed at a running instance of this app.

```bash
cd agent
docker compose up --build
```
