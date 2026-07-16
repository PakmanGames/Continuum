import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { requireAgent } from "~/server/agent-auth";

const resolvePayload = z.object({
  agentId: z.number().int().positive(),
  /** What the agent did, e.g. "restart". Shown verbatim as the resolution. */
  action: z.string().min(1).max(256),
  note: z.string().max(768).optional(),
});

/** The agent closes an incident it healed. Only open incidents can be closed. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAgent(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const payload = resolvePayload.parse(await request.json());

    const [updated] = await db
      .update(schema.errors)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: "agent",
        resolution: payload.note
          ? `${payload.action}: ${payload.note}`
          : payload.action,
      })
      .where(
        and(
          eq(schema.errors.id, Number(id)),
          eq(schema.errors.agentId, payload.agentId),
          eq(schema.errors.resolved, false),
        ),
      )
      .returning();
    if (!updated) {
      return NextResponse.json(
        { error: "No open incident with that id for this agent." },
        { status: 404 },
      );
    }
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid resolution." }, { status: 400 });
    }
    console.error("Agent resolve failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
