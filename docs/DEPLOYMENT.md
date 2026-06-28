# Deploying Continiuum to Vercel

This guide walks you through deploying the Continiuum incident-management dashboard
to [Vercel](https://vercel.com) from scratch. Follow it top to bottom and you will
end up with a live, publicly reachable deployment backed by a managed Postgres
database and Clerk authentication.

If you get stuck, jump to [Troubleshooting](#troubleshooting) at the bottom.

---

## 1. What you are deploying

Continiuum is a **[Next.js 15](https://nextjs.org) app** (App Router, React 19,
Tailwind 4) built on the [T3 stack](https://create.t3.gg). The web app is the only
thing that goes to Vercel.

| Concern | Technology | What it needs |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Auto-detected by Vercel |
| Package manager | **pnpm** 10.x (`pnpm-lock.yaml`) | Auto-detected by Vercel |
| Database | Any Postgres via `drizzle-orm/postgres-js` | `POSTGRES_URL` |
| Auth | [Clerk](https://clerk.com) (`@clerk/nextjs`) | Clerk publishable + secret keys |
| Voice alerts (optional) | [ElevenLabs](https://elevenlabs.io) | `ELEVENLABS_API_KEY` |
| SMS alerts (optional) | [Twilio](https://twilio.com) | Twilio account SID / token / numbers |

> **Not deployed to Vercel:** the `agent/` directory is a **separate Python /
> Docker service** (the log-analysis agent). It is out of scope for the Vercel web
> deployment and is covered briefly in [The agent service](#appendix-the-agent-service).

---

## 2. Prerequisites

Before you start, create/collect the following. Everything here has a free tier.

1. **A Vercel account** — <https://vercel.com/signup>. Sign in with the Git
   provider (GitHub/GitLab/Bitbucket) that hosts this repository.
2. **A Neon account** for Postgres — <https://neon.tech> (or use Vercel's built-in
   Neon integration, described below).
3. **A Clerk account** for authentication — <https://clerk.com>.
4. **Local tooling** (only needed to push the database schema and to test locally):
   - [Node.js](https://nodejs.org) **20 or newer**
   - [pnpm](https://pnpm.io/installation) 10.x — install with `npm install -g pnpm`
   - [Git](https://git-scm.com)
5. **(Optional)** ElevenLabs and Twilio accounts if you want voice/SMS alerting.

---

## 3. Provision the database (Neon Postgres)

The app talks to Postgres over the standard wire protocol, so any provider works.
This guide uses Neon because Vercel can provision it for you; substitute your own
connection string if you host Postgres elsewhere.

You have two options:

### Option A — Create Neon through Vercel (recommended)

Do this *after* you import the project (Step 5). In the Vercel dashboard:

1. Open your project → **Storage** → **Create Database** → **Neon (Postgres)**.
2. Follow the prompts to create the database and connect it to the project.
3. Vercel automatically injects the connection environment variables (including a
   `POSTGRES_URL`) into your project. You still need to confirm the variable is
   named exactly `POSTGRES_URL` (see [Step 6](#6-configure-environment-variables)).

### Option B — Create Neon directly

1. Go to <https://console.neon.tech> → **New Project**.
2. After it provisions, open **Dashboard → Connection Details**.
3. Copy the **pooled** connection string. It looks like:

   ```
   postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<db>?sslmode=require
   ```

4. Save this — it becomes the `POSTGRES_URL` value in Step 6.

> **Any Postgres provider works.** `src/server/db/index.ts` connects with
> `postgres.js` through `drizzle-orm/postgres-js`, which speaks the standard
> Postgres wire protocol, so Neon, Railway, Supabase, RDS or a local instance are
> all reachable with the right `POSTGRES_URL`. Neon stays the path of least
> resistance only because Vercel provisions it for you.
>
> **TODO — make provider support genuinely universal.** The connection is opened
> with no provider-specific tuning, which leaves two sharp edges. Serverless
> deployments against a provider without a built-in pooler can exhaust
> `max_connections`, because every warm function instance holds its own sockets.
> Providers also disagree on TLS: some require `sslmode=require` in the URL, some
> reject it. Worth designing a small adapter here that derives driver options
> (`max`, `ssl`, `prepare`) from the connection URL or an explicit `DB_PROVIDER`
> variable, so moving between providers is a config change rather than a code
> change.

---

## 4. Set up Clerk authentication

The app wraps every page in `<ClerkProvider>` (`src/app/layout.tsx`) and protects
`/dashboard`, `/timeline`, `/servers`, `/user`, and `/error` routes via
`src/middleware.ts`. Without Clerk keys, authentication (and those routes) will
not work.

1. Go to <https://dashboard.clerk.com> → **Create application**.
2. Choose your sign-in methods (email, Google, etc.) and create it.
3. Open **API Keys** in the Clerk dashboard. Copy:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`
4. Keep these for Step 6.

> These two variables are read directly by the Clerk SDK from the environment.
> They are intentionally **not** listed in `src/env.js`, so the build will **not**
> warn you if they are missing — auth will just silently fail. Double-check them.

After deployment, add your production domain to Clerk under
**Configure → Domains** (or use Clerk's hosted account portal) so sign-in
redirects resolve correctly.

---

## 5. Import the repository into Vercel

1. Push this repository to your Git provider if it isn't already there.
2. In Vercel: **Add New… → Project → Import Git Repository**, and select this repo.
3. Vercel auto-detects the settings — you should **not** need to change them:
   - **Framework Preset:** Next.js
   - **Build Command:** `next build` (default)
   - **Install Command:** `pnpm install` (detected from `pnpm-lock.yaml`)
   - **Output Directory:** `.next` (default)
   - **Root Directory:** `./` (leave as-is)
4. **Do not deploy yet.** First add environment variables (next step). If you
   already clicked Deploy and it failed because of missing env vars, that's fine —
   add them and redeploy.

> There is no `vercel.json` in this repo and you don't need one. The defaults are
> correct.

### Handle the Git submodule before your first build

`.gitmodules` declares a submodule at `examples/demo-1` using an **SSH** URL
(`git@github.com:…`). Vercel clones over HTTPS and cannot authenticate SSH
submodules, so if Vercel tries to initialize it, the build can fail with a
submodule/clone error. The submodule is **not** used by the app build.

Pick one fix:

- **Easiest:** In Vercel → **Settings → Git**, disable submodule checkout if the
  option is present, or
- **Repo fix:** change the submodule URL to HTTPS:

  ```bash
  git submodule set-url examples/demo-1 https://github.com/PakmanGames/continiuum-continued-demo.git
  git commit -am "chore: use HTTPS URL for demo submodule"
  ```

  (This only helps if the submodule repo is public or the build has access.)

---

## 6. Configure environment variables

In Vercel: **Project → Settings → Environment Variables**. Add each variable below
to **all** environments (Production, Preview, Development) unless you have a reason
not to.

### Required

| Variable | Where it comes from | Notes |
| --- | --- | --- |
| `POSTGRES_URL` | Neon connection string (Step 3) | **Required at build time too** — see the warning below. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk API Keys (Step 4) | Exposed to the browser (the `NEXT_PUBLIC_` prefix is required). |
| `CLERK_SECRET_KEY` | Clerk API Keys (Step 4) | Server-side secret — never expose it. |

> **Build-time requirement:** `next.config.js` imports `src/env.js`, which validates
> `POSTGRES_URL` with `z.string().url()` at build time. If it is missing or not a
> valid URL, **the build fails** before any page renders. Make sure it is set for
> the Production (and Preview) environment. If you use Vercel's Neon integration,
> confirm the injected variable is literally named `POSTGRES_URL`.

### Optional (alerting features)

These are declared `.optional()` in `src/env.js`, so the app builds and runs
without them. Add them only if you want the corresponding feature.

| Variable | Feature | Source |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | Voice alerts | ElevenLabs dashboard |
| `TWILIO_ACCOUNT_SID` | SMS alerts | Twilio console |
| `TWILIO_AUTH_TOKEN` | SMS alerts | Twilio console |
| `TWILIO_PHONE_NUMBER` | SMS "from" number, e.g. `+15551234567` | Twilio console |
| `ALERT_PHONE_NUMBER` | SMS "to" number, e.g. `+15557654321` | Your phone |

> **Empty strings are treated as undefined** (`emptyStringAsUndefined: true` in
> `src/env.js`). Don't set an optional variable to an empty value — either give it
> a real value or leave it out entirely.

> **Escape hatch:** setting `SKIP_ENV_VALIDATION=1` bypasses all env validation at
> build time. Only use it for debugging a build; it does not make the app work
> without a real database at runtime.

---

## 7. Push the database schema

Vercel does **not** run database migrations for you. The Neon database is empty
after Step 3, so you must create the tables once from your local machine.

The schema lives in `src/server/db/schema.ts` and all tables are prefixed
`HW12_` (see `tablesFilter` in `drizzle.config.ts`).

1. Clone the repo locally (if you haven't) and install dependencies:

   ```bash
   git clone <your-repo-url>
   cd continuum-continued
   pnpm install
   ```

2. Create a local `.env` file pointing at your **production** Neon database:

   ```bash
   # .env  (this file is gitignored — never commit it)
   POSTGRES_URL="postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/<db>?sslmode=require"
   ```

3. Push the schema to the database:

   ```bash
   pnpm db:push
   ```

   `db:push` reads `drizzle.config.ts` (which reads `POSTGRES_URL` from your `.env`)
   and creates the tables directly. This is the fastest way to get a fresh database
   in sync.

   > If you prefer versioned migrations instead of a direct push, run
   > `pnpm db:generate` then `pnpm db:migrate`. The SQL migration files live in
   > `drizzle/`.

4. **(Optional) Seed demo data.** To populate historical incidents so the
   dashboard isn't empty:

   ```bash
   pnpm db:seed-historical
   ```

   This runs `src/scripts/seed-historical-incidents.ts` against the database in
   your `.env`.

5. **(Optional) Inspect the database** with Drizzle Studio:

   ```bash
   pnpm db:studio
   ```

---

## 8. Deploy

1. Back in Vercel, trigger a deploy — either click **Deploy** on the import screen,
   or push a commit / open the project and hit **Redeploy**.
2. Watch the build logs. A successful build ends with Next.js route output and a
   "Deployment completed" message.
3. Vercel gives you a URL like `https://<project>.vercel.app`.

Every push to your production branch will auto-deploy from now on. Pull requests
get their own Preview deployments (make sure Preview also has the env vars).

---

## 9. Post-deploy verification

Walk the end-to-end path, not just "the page loaded":

1. **Home page loads.** Visit the deployment URL — the landing page should render.
2. **Auth works.** Try to open `/dashboard`. Unauthenticated, `middleware.ts`
   should redirect you to `/`. Sign in via Clerk, then reach `/dashboard`
   successfully.
3. **Database is wired.** With demo data seeded, the dashboard, `/timeline`, and
   `/servers` pages should show incidents/servers instead of empty states.
4. **API is alive.** The agent ingestion endpoints exist at:
   - `POST /api/agent/data-ingest` — insert an error/incident
   - `POST /api/agent/heartbeat` — record a container heartbeat

   You can smoke-test the heartbeat with `curl` (adjust `containerId` to a valid one):

   ```bash
   curl -X POST https://<project>.vercel.app/api/agent/heartbeat \
     -H "Content-Type: application/json" \
     -d '{"containerId": 1}'
   ```

   A `200` with `{"message":"Heartbeat recorded successfully"}` means the API and
   database round-trip works.

---

## 10. Real-time updates: the dashboard polls

The dashboard keeps itself current by **polling** — it re-reads `/api/servers` and
`/api/error` every few seconds (`src/app/dashboard/page.tsx`). There is nothing to
configure, and it behaves the same locally and on Vercel.

That is a deliberate choice rather than a fallback. The repository also contains a
Server-Sent Events endpoint at `/api/events`, backed by an in-memory emitter
(`src/lib/websocket-server.ts`) that `POST /api/agent/data-ingest` notifies when new
data arrives. **No part of the UI consumes it**, because the pattern cannot work on
serverless: each function invocation runs in an isolated instance, so a `notify()`
raised in one instance can never reach an SSE stream held open by a different one.
Push updates would silently fail to arrive in production.

If you later want real push rather than polling, the emitter has to move out of
process — for example:

- [Upstash Redis](https://upstash.com) pub/sub,
- a hosted realtime service (Ably, Pusher).

Either is a code change, not a config change, and is out of scope for a first deploy.

---

## Troubleshooting

**Build fails with an env/Zod error mentioning `POSTGRES_URL`.**
`POSTGRES_URL` is missing or not a valid URL in the environment being built. Set it
in Vercel → Settings → Environment Variables for the Production (and Preview)
environment, then redeploy. Confirm it's a full `postgresql://…` URL.

**Build fails cloning `examples/demo-1` / a submodule error.**
See [Handle the Git submodule](#handle-the-git-submodule-before-your-first-build).
Disable submodule checkout in Vercel or switch the submodule to an HTTPS URL.

**Build uses npm instead of pnpm, or dependency resolution looks wrong.**
Vercel should detect pnpm from `pnpm-lock.yaml`. A stray `package-lock.json` also
exists in the repo and can create ambiguity — deleting it removes any doubt:

```bash
git rm package-lock.json
git commit -m "chore: drop npm lockfile, standardize on pnpm"
```

**App loads but sign-in is broken / every protected route bounces to `/`.**
Clerk keys are missing or wrong. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and
`CLERK_SECRET_KEY` in Vercel, and add your production domain in the Clerk
dashboard. Remember these are not validated at build time, so the build can succeed
while auth is still misconfigured.

**Pages load but data is empty / API routes 500.**
The database schema was never pushed, or `POSTGRES_URL` points at the wrong
database. Re-run [Step 7](#7-push-the-database-schema) against the same database
the deployment uses.

**Live dashboard updates don't appear.**
The dashboard polls every few seconds, so check the browser console for failing
requests to `/api/servers` or `/api/error` — that is the refresh path. See
[Real-time updates](#10-real-time-updates-the-dashboard-polls).

---

## Appendix: The agent service

The `agent/` directory is a standalone **Python** service (see `agent/Dockerfile`
and `agent/docker-compose.yml`) that analyzes logs and pushes incidents/heartbeats
back to this web app's API. **It does not run on Vercel.** Deploy it separately
(e.g. as a container on Fly.io, Railway, Render, or your own host).

Its configuration (`agent/.env.example`) includes:

| Variable | Purpose |
| --- | --- |
| `GENAI_API_KEY` | Google Gemini API key |
| `AGENT_BACKEND_URL` | URL of this deployed web app (e.g. `https://<project>.vercel.app`) |
| `AGENT_ID` | Identifier for this agent instance |
| `GIT_REPO_URL` | (Optional) repo the agent clones for deeper analysis |

Point `AGENT_BACKEND_URL` at your Vercel deployment so the agent's heartbeats and
ingested data land in the right place.

---

## Quick reference

```bash
# One-time local setup to push schema to the production DB
pnpm install
echo 'POSTGRES_URL="<neon-pooled-connection-string>"' > .env
pnpm db:push                 # create tables
pnpm db:seed-historical      # (optional) demo data

# Local dev server
pnpm run dev                 # http://localhost:3000
```

**Vercel environment variables checklist:**

- [ ] `POSTGRES_URL` (required, needed at build time)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (required)
- [ ] `CLERK_SECRET_KEY` (required)
- [ ] `ELEVENLABS_API_KEY` (optional)
- [ ] `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` / `ALERT_PHONE_NUMBER` (optional)
