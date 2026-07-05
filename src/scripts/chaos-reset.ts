import { like } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { CHAOS_PREFIX } from "~/lib/chaos";

/**
 * Clears everything the chaos demo left behind so a recording can start from
 * the seeded state.
 *
 * Only incidents whose log carries the `[Chaos]` prefix are removed — real
 * incidents are untouched. The `db:chaos-reset` npm script chains
 * `db:seed-heartbeats` after this, which puts every container's check-ins back
 * to the seeded window and turns the agents green again.
 */
async function chaosReset() {
  console.log("🧹 Removing chaos incidents...");

  const removed = await db
    .delete(schema.errors)
    .where(like(schema.errors.errorMessage, `${CHAOS_PREFIX}%`))
    .returning({ id: schema.errors.id });

  console.log(
    removed.length === 0
      ? "  ✓ None found — nothing to remove"
      : `  ✓ Removed ${removed.length} chaos incident(s)`,
  );
}

chaosReset()
  .then(() => {
    console.log("Chaos incidents cleared; re-seeding heartbeats next");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Reset failed:", error);
    process.exit(1);
  });
