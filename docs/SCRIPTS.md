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
| `pnpm db:chaos-reset` | Deletes every `[Chaos]` incident, then re-runs `db:seed-heartbeats`. Run before recording a demo. | **Yes — data** |

Tables are prefixed `HW12_` (see `tablesFilter` in `drizzle.config.ts`), a
holdover from the original hackathon project name.

### Data model note

Agents are first-class since migration `0002`: `HW12_agent` holds each registered
agent (its `lastSeen` is bumped on every call it makes), `HW12_container.agentId`
records who watches a container, and `HW12_agent_command` is the queue the control
plane uses to ask an agent to `kill` / `stop` / `start` / `restart` one. An agent
announces itself and its targets with `POST /api/agent/register` (idempotent, upserts
by name) and polls `GET /api/agent/commands?agentId=` for work.

Seeded rows (`source = seed`) have no agent. For those, `GET /api/topology` still
**derives** a demo agent per container, wired into a ring, and labels it "demo" — the
seam is `src/lib/topology.ts`. A watch relationship is currently one agent per
container; agents watching each other, or several agents per container, would need
a separate `watches` table.

### `db:push` vs `db:generate` + `db:migrate`

`db:push` diffs your schema against the live database and applies the change
directly — no migration file, no history. Good for local iteration. Use
`db:generate` + `db:migrate` when you want the change reviewed in a PR and
replayed identically on another environment.

The migration history in `drizzle/` starts from a baseline generated in September
2026 (`0000_…`) that matches the production database; everything after it is a
real, replayable change. A database that was created with `db:push` before that
baseline already has the tables, so `db:migrate` would fail trying to create
them again — record the baseline as applied first (one row in
`drizzle.__drizzle_migrations` with the file's SHA-256 and the journal's `when`).

### The seed scripts

**`db:seed-historical`** → `src/scripts/seed-historical-incidents.ts`

Creates four containers (`worker-pool-01`, `api-gateway-01`, `db-cluster-01`,
`auth-service-02`) if they don't exist, then inserts ten incidents spread from
today back to 89 days ago. One is deliberately left unresolved so the dashboard
has an open incident to show.

> **Not idempotent.** Containers are guarded by a name check, but incidents are
> inserted unconditionally — running it twice gives you twenty incidents. To
> start over, clear `HW12_error` first.

**`db:chaos-reset`** → `src/scripts/chaos-reset.ts`, then `db:seed-heartbeats`

Removes the incidents the chaos demo on `/topology` created and resets check-ins. See
[Rehearsing the chaos demo](#rehearsing-the-chaos-demo).

**`db:seed-heartbeats`** → `src/scripts/seed-heartbeats.ts`

Writes 24 check-ins per container, one every 5 minutes over the last 2 hours.
`worker-pool-01` gets a `crashed` status on its most recent check-in so it lines
up with the unresolved incident from the other seed.

This one **is** re-runnable: check-ins are regenerable telemetry, so the script
clears `HW12_status` and lays down a fresh window instead of appending. Re-run
it whenever the seeded check-ins have aged enough to look stale.

> Requires containers to exist — run `db:seed-historical` first, or it exits
> with a warning.

### Seed data ages — refresh before a demo

Both seeds place rows relative to *when they ran*, so a database seeded last week
shows a fleet whose last check-in was days ago and a newest incident that is no
longer recent. The dashboard's "Last 24 hours" tile and the right-hand edge of the
incidents chart go empty as a result.

`db:seed-heartbeats` is safe to re-run and fixes the check-in half. The incident half
has no refresh path yet: re-running `db:seed-historical` **appends** a second set of
ten incidents rather than restamping the existing ones. To genuinely reset it, clear
`HW12_error` first and then re-seed.

### Rehearsing the chaos demo

The chaos demo on `/topology` is repeatable: each run crashes the chosen service on
paper, heals it, and leaves a resolved `[Chaos]` incident behind (the newest five are
kept, older ones are pruned automatically). The service is running again as soon as
the run finishes, so you can run it back-to-back.

Two things to know before recording:

- **Agents go amber after 10 minutes.** Agent health is check-in freshness, and the
  seed stamps check-ins at the moment it runs. Run `pnpm db:seed-heartbeats` right
  before you record so every agent starts green.
- **Trial runs show up on the dashboard and timeline** — that is the point, but the
  chaos incidents resolve in seconds, so a few rehearsals pull the MTTR tile down
  from the seeded 1h. For a clean slate, one command:

  ```bash
  pnpm db:chaos-reset
  ```

  It deletes every `[Chaos]` incident (real incidents are untouched — chaos rows
  are identified by that log prefix) and then re-runs `db:seed-heartbeats`, which
  resets check-ins to the seeded window and turns the agents green. It also
  recovers from a run that failed mid-way and left a service crashed on paper.

**Recording-day sequence:** `pnpm db:chaos-reset` → sign in → `/topology` → record.

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
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` / `ALERT_PHONE_NUMBER` | Voice alerts | Optional |
| `AGENT_TOKEN` | The Python agent's access to `/api/agent/*` — routes answer 503 until it is set | Optional |

> **Setting the Twilio variables makes every `POST /api/agent/data-ingest` place a
> real phone call** to `ALERT_PHONE_NUMBER`. The endpoint is gated by `AGENT_TOKEN`,
> so keep that token secret, and leave the Twilio variables unset on any deployment
> where the agent may fire often. The chaos demo on `/topology` deliberately does not go
> through the ingest path, so it never dials out.

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
