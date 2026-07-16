import { and, desc, eq, inArray, like } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import {
  CHAOS_FAULTS,
  CHAOS_KEEP,
  CHAOS_PREFIX,
  type ChaosHealResult,
  type ChaosInjectResult,
} from "~/lib/chaos";

/**
 * Crashes a service on paper: a `crashed` check-in plus an open incident with a
 * scripted diagnosis. Returns null if the container doesn't exist.
 */
export async function injectFault(
  containerId: number,
): Promise<ChaosInjectResult | null> {
  const [container] = await db
    .select()
    .from(schema.containers)
    .where(eq(schema.containers.id, containerId));
  // Only the seeded fleet can be crashed on paper — a live container's state
  // is the agent's to report, so faking it would put a lie on the timeline.
  if (!container || container.source !== "seed") return null;

  // Demos accumulate; keep the newest few chaos incidents and drop the rest
  // so the timeline doesn't fill with identical scripted faults.
  const stale = await db
    .select({ id: schema.errors.id })
    .from(schema.errors)
    .where(like(schema.errors.errorMessage, `${CHAOS_PREFIX}%`))
    .orderBy(desc(schema.errors.occurredAt))
    .offset(CHAOS_KEEP - 1);
  if (stale.length > 0) {
    await db.delete(schema.errors).where(
      inArray(
        schema.errors.id,
        stale.map((row) => row.id),
      ),
    );
  }

  const fault = CHAOS_FAULTS[Math.floor(Math.random() * CHAOS_FAULTS.length)]!;
  const now = new Date();

  await db
    .insert(schema.statuses)
    .values({ containerId, status: "crashed", checkedInAt: now });

  const [incident] = await db
    .insert(schema.errors)
    .values({
      // The topology derives one agent per container with the same id, so
      // this is "reported by the agent watching this service".
      agentId: containerId,
      containerId,
      serviceName: container.name,
      errorMessage: `${CHAOS_PREFIX} ${fault.logs}`,
      explaination: fault.explanation,
      suggestedFix: fault.suggestedFix,
      occurredAt: now,
    })
    .returning({ id: schema.errors.id });

  return {
    incidentId: incident!.id,
    container: container.name,
    fault,
    occurredAt: now.toISOString(),
  };
}

/**
 * Applies the fix on paper: resolves the incident and files a `running`
 * check-in. Only touches incidents this demo created, so it can never close a
 * real one. Returns null if there is no matching open chaos incident.
 */
export async function healFault(
  containerId: number,
  incidentId: number,
): Promise<ChaosHealResult | null> {
  const now = new Date();

  const [healed] = await db
    .update(schema.errors)
    .set({ resolved: true, resolvedAt: now })
    .where(
      and(
        eq(schema.errors.id, incidentId),
        eq(schema.errors.containerId, containerId),
        like(schema.errors.errorMessage, `${CHAOS_PREFIX}%`),
      ),
    )
    .returning({ occurredAt: schema.errors.occurredAt });
  if (!healed) return null;

  await db
    .insert(schema.statuses)
    .values({ containerId, status: "running", checkedInAt: now });

  return {
    occurredAt: healed.occurredAt.toISOString(),
    resolvedAt: now.toISOString(),
  };
}
