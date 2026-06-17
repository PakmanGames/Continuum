import { db } from "~/server/db";
import * as schema from "~/server/db/schema";

/**
 * Seeds container check-ins.
 *
 * `/api/servers` reads the most recent `statuses` row per container and falls
 * back to "stopped" when there is none, so an empty table renders the whole
 * fleet as dead. In a deployment the Python agent fills this in; locally and on
 * the demo database it has to be seeded.
 *
 * Unlike `seed-historical-incidents`, this script is re-runnable: check-ins are
 * regenerable telemetry, so it clears the table and lays down a fresh window
 * rather than appending a duplicate history on every run.
 */

const MINUTE_MS = 60_000;

/** Spacing between consecutive check-ins. */
const INTERVAL_MINUTES = 5;

/** How far back to lay down history. */
const WINDOW_HOURS = 2;

/**
 * Containers whose latest check-in should report trouble instead of "running".
 * A fleet that is uniformly green has nothing for the dashboard to show, and
 * worker-pool-01 owns the one unresolved incident in the incident seed.
 */
const FAILING: Record<string, string> = {
  "worker-pool-01": "crashed",
};

async function seedHeartbeats() {
  console.log("🌱 Seeding container heartbeats...");

  const containers = await db.select().from(schema.containers);

  if (containers.length === 0) {
    console.warn(
      "  ⚠ No containers found. Run `pnpm db:seed-historical` first — it creates them.",
    );
    return;
  }

  const cleared = await db.delete(schema.statuses).returning({
    id: schema.statuses.id,
  });
  if (cleared.length > 0) {
    console.log(`  ✓ Cleared ${cleared.length} existing check-in(s)`);
  }

  const ticks = (WINDOW_HOURS * 60) / INTERVAL_MINUTES;
  const now = Date.now();

  for (const container of containers) {
    const failureStatus = FAILING[container.name];

    const rows = Array.from({ length: ticks }, (_, index) => {
      // index 0 is the oldest check-in, the last is the most recent.
      const minutesAgo = (ticks - 1 - index) * INTERVAL_MINUTES;

      return {
        containerId: container.id,
        // Only the newest check-in carries the failure — the container was
        // healthy up to the point it fell over.
        status: failureStatus && minutesAgo === 0 ? failureStatus : "running",
        checkedInAt: new Date(now - minutesAgo * MINUTE_MS),
      };
    });

    await db.insert(schema.statuses).values(rows);

    console.log(
      `  ✓ ${container.name.padEnd(18)} ${rows.length} check-ins, now ${failureStatus ?? "running"}`,
    );
  }

  console.log("✅ Heartbeat seeding complete!");
}

seedHeartbeats()
  .then(() => {
    console.log("Seeding completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
