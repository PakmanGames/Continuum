import { and, desc, eq } from "drizzle-orm";

import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import type {
  AgentCommand,
  CommandAction,
  CommandStatus,
} from "~/lib/commands";

type Row = typeof schema.agentCommands.$inferSelect & { containerName: string };

const toCommand = (r: Row): AgentCommand => ({
  id: r.id,
  agentId: r.agentId,
  containerId: r.containerId,
  containerName: r.containerName,
  action: r.action as CommandAction,
  status: r.status as CommandStatus,
  result: r.result,
  createdAt: r.createdAt.toISOString(),
  completedAt: r.completedAt?.toISOString() ?? null,
});

const selection = {
  id: schema.agentCommands.id,
  agentId: schema.agentCommands.agentId,
  containerId: schema.agentCommands.containerId,
  containerName: schema.containers.name,
  action: schema.agentCommands.action,
  status: schema.agentCommands.status,
  result: schema.agentCommands.result,
  createdAt: schema.agentCommands.createdAt,
  completedAt: schema.agentCommands.completedAt,
};

/**
 * Queues work for the agent that owns a container. Seeded demo rows have no
 * agent, so they cannot be commanded — the simulated chaos demo covers those.
 */
export async function enqueueCommand(
  containerId: number,
  action: CommandAction,
): Promise<
  { command: AgentCommand } | { error: "not-found" | "no-agent" }
> {
  const [container] = await db
    .select()
    .from(schema.containers)
    .where(eq(schema.containers.id, containerId));
  if (!container) return { error: "not-found" };
  if (container.agentId === null) return { error: "no-agent" };

  const [row] = await db
    .insert(schema.agentCommands)
    .values({ agentId: container.agentId, containerId, action })
    .returning();
  return { command: toCommand({ ...row!, containerName: container.name }) };
}

/** What an agent should do next, oldest first. Also bumps its `lastSeen`. */
export async function pendingCommandsFor(
  agentId: number,
): Promise<AgentCommand[] | null> {
  const [agent] = await db
    .update(schema.agents)
    .set({ lastSeen: new Date() })
    .where(eq(schema.agents.id, agentId))
    .returning({ id: schema.agents.id });
  if (!agent) return null;

  const rows = await db
    .select(selection)
    .from(schema.agentCommands)
    .innerJoin(
      schema.containers,
      eq(schema.agentCommands.containerId, schema.containers.id),
    )
    .where(
      and(
        eq(schema.agentCommands.agentId, agentId),
        eq(schema.agentCommands.status, "pending"),
      ),
    )
    .orderBy(schema.agentCommands.id);
  return rows.map(toCommand);
}

/** Closes a command. Only the owning agent can, and only while it is pending. */
export async function ackCommand(
  id: number,
  agentId: number,
  status: Exclude<CommandStatus, "pending">,
  result: string | null,
): Promise<AgentCommand | null> {
  const [row] = await db
    .update(schema.agentCommands)
    .set({ status, result, completedAt: new Date() })
    .where(
      and(
        eq(schema.agentCommands.id, id),
        eq(schema.agentCommands.agentId, agentId),
        eq(schema.agentCommands.status, "pending"),
      ),
    )
    .returning();
  if (!row) return null;
  const [container] = await db
    .select({ name: schema.containers.name })
    .from(schema.containers)
    .where(eq(schema.containers.id, row.containerId));
  return toCommand({ ...row, containerName: container?.name ?? "" });
}

/** Newest commands for one container — what the UI polls to show progress. */
export async function recentCommands(
  containerId: number,
  limit = 10,
): Promise<AgentCommand[]> {
  const rows = await db
    .select(selection)
    .from(schema.agentCommands)
    .innerJoin(
      schema.containers,
      eq(schema.agentCommands.containerId, schema.containers.id),
    )
    .where(eq(schema.agentCommands.containerId, containerId))
    .orderBy(desc(schema.agentCommands.id))
    .limit(limit);
  return rows.map(toCommand);
}
