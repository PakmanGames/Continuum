import { NextResponse } from "next/server";

import { requireAgent } from "~/server/agent-auth";
import { pendingCommandsFor } from "~/server/commands";

/** The agent's poll: pending work for `?agentId=`. Bumps the agent's `lastSeen`. */
export async function GET(request: Request) {
  const denied = requireAgent(request);
  if (denied) return denied;

  const agentId = Number(new URL(request.url).searchParams.get("agentId"));
  if (!Number.isInteger(agentId) || agentId <= 0) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }

  try {
    const commands = await pendingCommandsFor(agentId);
    if (commands === null) {
      return NextResponse.json({ error: "Unknown agent." }, { status: 404 });
    }
    return NextResponse.json({ commands }, { status: 200 });
  } catch (error) {
    console.error("Command poll failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
