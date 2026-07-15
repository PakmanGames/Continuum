import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { env } from "~/env";

/**
 * Gate for every `/api/agent/*` route. The agent proves itself with a shared
 * secret (`Authorization: Bearer <AGENT_TOKEN>`); anything else is refused.
 *
 * Returns a ready response when the request must be rejected, or `null` when
 * it may proceed — so a handler is one line: `const denied = requireAgent(req);
 * if (denied) return denied;`. When no token is configured at all the routes
 * refuse outright rather than silently opening up: an unauthenticated ingest
 * endpoint on a public URL is how strangers end up on the incident timeline.
 */
export function requireAgent(request: Request): NextResponse | null {
  if (!env.AGENT_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Agent access is not configured on this deployment (AGENT_TOKEN).",
      },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const expected = Buffer.from(env.AGENT_TOKEN);
  const given = Buffer.from(presented);

  // Length check first: timingSafeEqual throws on mismatched lengths.
  const ok =
    given.length === expected.length && timingSafeEqual(given, expected);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid agent token." },
      { status: 401 },
    );
  }
  return null;
}
