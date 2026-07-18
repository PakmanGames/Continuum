import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { late } from "zod";
import { containerMetrics } from "~/lib/metrics";
import type { ContainerStatus } from "~/lib/container-status";

export async function GET(request: Request) {
  try {
    // Get all containers
    const containers = await db.select().from(schema.containers);

    // Get latest status for each container
    const servers = await Promise.all(
      containers.map(async (container) => {
        const latestStatus = await db
          .select()
          .from(schema.statuses)
          .where(eq(schema.statuses.containerId, container.id))
          .orderBy(desc(schema.statuses.checkedInAt))
          .limit(1);

        const status =
          (latestStatus[0]?.status as ContainerStatus | undefined) ?? "stopped";

        // Only a live container consumes anything — a stopped or crashed one
        // reporting 60% CPU reads as obviously fake. Running containers get
        // their deterministic profile, which holds still across refreshes.
        const { cpu, memory } =
          status === "running"
            ? containerMetrics(container.id)
            : { cpu: 0, memory: 0 };

        return {
          id: container.id.toString(),
          name: container.name,
          source: container.source,
          agentId: container.agentId,
          status,
          cpu,
          memory,
          updatedAt: latestStatus[0]?.checkedInAt ?? container.createdAt,
          lastCrashTime: undefined,
        };
      }),
    );

    return NextResponse.json(servers, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
