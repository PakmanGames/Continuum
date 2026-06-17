import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";

const signupPayload = z.object({
  email: z.string().email().max(256),
  note: z.string().max(1024).optional(),
});

export async function POST(request: Request) {
  try {
    const payload = signupPayload.parse(await request.json());

    // Re-submitting an address is a deliberate no-op. Reporting "already
    // signed up" would let anyone probe whether a given email is on the list,
    // so the caller sees the same success either way.
    await db
      .insert(schema.waitlist)
      .values({
        email: payload.email.trim().toLowerCase(),
        note: payload.note?.trim() ?? null,
      })
      .onConflictDoNothing({ target: schema.waitlist.email });

    return NextResponse.json(
      { message: "You're on the list" },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    console.error("Waitlist signup failed:", error);
    return NextResponse.json(
      { error: "Something went wrong. Try again in a moment." },
      { status: 500 },
    );
  }
}
