import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAgent } from "~/server/agent-auth";
import { ackCommand } from "~/server/commands";

const ackPayload = z.object({
  agentId: z.number().int().positive(),
  status: z.enum(["done", "failed"]),
  result: z.string().max(1024).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireAgent(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const payload = ackPayload.parse(await request.json());
    const command = await ackCommand(
      Number(id),
      payload.agentId,
      payload.status,
      payload.result ?? null,
    );
    if (!command) {
      return NextResponse.json(
        { error: "No pending command with that id for this agent." },
        { status: 404 },
      );
    }
    return NextResponse.json(command, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid ack." }, { status: 400 });
    }
    console.error("Command ack failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
