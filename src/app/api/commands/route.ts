import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { COMMAND_ACTIONS } from "~/lib/commands";
import { enqueueCommand, recentCommands } from "~/server/commands";

const enqueuePayload = z.object({
  containerId: z.number().int().positive(),
  action: z.enum(COMMAND_ACTIONS),
});

/** Queue a command for a live container. Signed-in users only — this acts on real containers. */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to control containers." }, { status: 401 });
  }
  try {
    const payload = enqueuePayload.parse(await request.json());
    const result = await enqueueCommand(payload.containerId, payload.action);
    if ("error" in result) {
      return result.error === "not-found"
        ? NextResponse.json({ error: "Unknown container." }, { status: 404 })
        : NextResponse.json(
            { error: "That container has no agent to carry out commands." },
            { status: 409 },
          );
    }
    return NextResponse.json(result.command, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid command." }, { status: 400 });
    }
    console.error("Enqueue failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Recent commands for `?containerId=`, newest first — the UI polls this for progress. */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to control containers." }, { status: 401 });
  }
  const containerId = Number(new URL(request.url).searchParams.get("containerId"));
  if (!Number.isInteger(containerId) || containerId <= 0) {
    return NextResponse.json({ error: "containerId is required." }, { status: 400 });
  }
  try {
    return NextResponse.json({ commands: await recentCommands(containerId) }, { status: 200 });
  } catch (error) {
    console.error("Command list failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
