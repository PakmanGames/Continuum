import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { healFault, injectFault } from "~/server/chaos";

const chaosPayload = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("inject"),
    containerId: z.number().int().positive(),
  }),
  z.object({
    step: z.literal("heal"),
    containerId: z.number().int().positive(),
    incidentId: z.number().int().positive(),
  }),
]);

/**
 * Drives the chaos demo. Gated on a signed-in user because it writes real
 * rows — an anonymous visitor must not be able to crash the demo fleet.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to run the chaos demo." },
      { status: 401 },
    );
  }

  try {
    const payload = chaosPayload.parse(await request.json());

    const result =
      payload.step === "inject"
        ? await injectFault(payload.containerId)
        : await healFault(payload.containerId, payload.incidentId);

    if (!result) {
      return NextResponse.json(
        { error: "Nothing to act on for that container." },
        { status: 404 },
      );
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    console.error("Chaos step failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
