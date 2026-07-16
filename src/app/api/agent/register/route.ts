import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { requireAgent } from "~/server/agent-auth";

const registerPayload = z.object({
  agent: z.string().min(1).max(256),
  containers: z.array(z.string().min(1).max(256)).min(1).max(64),
});

/**
 * An agent announces itself and the containers it watches. Idempotent: the
 * agent is upserted by name, each container by its Docker name, and every
 * container is (re)assigned to this agent as a `live` row. Returns the ids the
 * agent must use for heartbeats and incidents from then on.
 */
export async function POST(request: Request) {
  const denied = requireAgent(request);
  if (denied) return denied;

  try {
    const payload = registerPayload.parse(await request.json());
    const now = new Date();

    const [agent] = await db
      .insert(schema.agents)
      .values({ name: payload.agent, lastSeen: now })
      .onConflictDoUpdate({
        target: schema.agents.name,
        set: { lastSeen: now },
      })
      .returning({ id: schema.agents.id });

    const ids: Record<string, number> = {};
    for (const name of new Set(payload.containers)) {
      const [row] = await db
        .insert(schema.containers)
        .values({ name, source: "live", agentId: agent!.id })
        .onConflictDoUpdate({
          target: schema.containers.name,
          set: { source: "live", agentId: agent!.id },
        })
        .returning({ id: schema.containers.id, name: schema.containers.name });
      ids[row!.name] = row!.id;
    }

    return NextResponse.json(
      { agentId: agent!.id, containers: ids },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid registration." }, { status: 400 });
    }
    console.error("Agent registration failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
