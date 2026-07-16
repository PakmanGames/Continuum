import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { requireAgent } from "~/server/agent-auth";
import { CONTAINER_STATUSES } from "~/lib/container-status";

const heartbeatPayload = z
  .object({
    containerId: z.number().int().positive(),
    status: z.enum(CONTAINER_STATUSES).default("running"),
    checkedInAt: z.union([z.string().datetime(), z.number()]).optional(),
    // The Python agent historically sent `timestamp`; accept it as an alias
    // so an un-upgraded agent's clock is no longer silently discarded.
    timestamp: z.union([z.string().datetime(), z.number()]).optional(),
  })
  .transform((p) => ({ ...p, checkedInAt: p.checkedInAt ?? p.timestamp }));

export async function POST(request: Request) {
  const denied = requireAgent(request);
  if (denied) return denied;

  try {
    const payload = heartbeatPayload.parse(await request.json());

    await db.insert(schema.statuses).values({
      containerId: payload.containerId,
      status: payload.status,
      checkedInAt:
        payload.checkedInAt !== undefined
          ? new Date(payload.checkedInAt)
          : new Date(),
    });

    return NextResponse.json(
      { message: "Heartbeat recorded successfully" },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid heartbeat." }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to record heartbeat" },
      { status: 500 },
    );
  }
}
