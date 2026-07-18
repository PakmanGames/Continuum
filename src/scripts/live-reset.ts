import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";

/**
 * Forgets every registered agent and the live containers they brought.
 *
 * Stopping an agent doesn't remove its rows — its node just goes stale on the
 * topology — so run this before a recording if the last live session's
 * "agent-local" shouldn't be in the picture. Seeded rows are untouched;
 * commands and check-ins for the removed containers cascade away with them.
 * The next `docker compose up` re-registers everything.
 */
async function liveReset() {
  console.log("🧹 Removing live containers and agents...");

  const live = await db
    .delete(schema.containers)
    .where(eq(schema.containers.source, "live"))
    .returning({ name: schema.containers.name });
  const agents = await db.delete(schema.agents).returning({ name: schema.agents.name });

  console.log(
    live.length === 0 && agents.length === 0
      ? "  ✓ Nothing live to remove"
      : `  ✓ Removed ${live.length} container(s) [${live.map((r) => r.name).join(", ")}] and ${agents.length} agent(s) [${agents.map((r) => r.name).join(", ")}]`,
  );
}

liveReset()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Reset failed:", error);
    process.exit(1);
  });
