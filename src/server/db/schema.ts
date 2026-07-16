// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `HW12_${name}`);

/**
 * A running agent process. Live containers point at the agent that registered
 * them, which is how the topology knows who watches what; `lastSeen` is bumped
 * on every authenticated call the agent makes, so it doubles as the agent's
 * own heartbeat.
 */
export const agents = createTable("agent", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  name: d.varchar({ length: 256 }).notNull().unique(),
  lastSeen: d.timestamp({ withTimezone: true }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
}));

export const containers = createTable("container", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  // Unique so `register` can upsert by name — a container is its Docker name.
  name: d.varchar({ length: 256 }).notNull().unique(),
  /**
   * Where the row came from. `seed` rows are the demo fleet the seed scripts
   * create; `live` rows are registered by a running agent. The topology labels
   * seed nodes "demo" so both can share one database — and one screen —
   * without pretending the seeded fleet is real.
   */
  source: d.varchar({ length: 8 }).default("live").notNull(),
  /** The agent watching this container. Null for seeded demo rows. */
  agentId: d.integer().references(() => agents.id, { onDelete: "set null" }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
}));

export const statuses = createTable("status", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  containerId: d
    .integer()
    .notNull()
    .references(() => containers.id, { onDelete: "cascade" }),
  status: d.varchar({ length: 256 }).notNull(),
  checkedInAt: d
    .timestamp({ withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
}));

export const errors = createTable("error", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  agentId: d.integer().notNull(),
  containerId: d
    .integer()
    .notNull()
    .references(() => containers.id, { onDelete: "cascade" }),
  serviceName: d.varchar({ length: 256 }).default("unknown").notNull(),
  errorMessage: d.varchar({ length: 4096 }).notNull(),
  explaination: d.varchar({ length: 4096 }).notNull(),
  suggestedFix: d.varchar({ length: 4096 }).notNull(),
  resolved: d.boolean().default(false).notNull(),
  resolvedAt: d.timestamp({ withTimezone: true }),
  /** "agent" when the remediation loop closed it, "human" when someone clicked. */
  resolvedBy: d.varchar({ length: 16 }),
  /** What closed it, e.g. "restart" — the honest label the UI shows. */
  resolution: d.varchar({ length: 1024 }),
  occurredAt: d
    .timestamp({ withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
}));

export const users = createTable("user", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  email: d.varchar({ length: 256 }).notNull(),
  name: d.varchar({ length: 256 }).notNull(),
  phoneNumber: d.varchar({ length: 256 }).notNull(),
  createdAt: d
    .timestamp({ withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
}));
// User and organization tables might not be necessary lets wait for clerk auth implementation first

/**
 * Marketing waitlist. The product is pre-release, so the landing page collects
 * interest instead of handing visitors a dashboard they cannot use yet.
 * `email` is unique so a repeat submission is an idempotent no-op rather than a
 * duplicate row — the signup form reports success either way.
 */
export const waitlist = createTable("waitlist", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  email: d.varchar({ length: 256 }).notNull().unique(),
  /** Optional free-text context, e.g. "we run 40 containers on ECS". */
  note: d.varchar({ length: 1024 }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
}));

/**
 * Work the control plane asks an agent to do. Agents sit behind NAT, so the
 * backend cannot push — the agent polls for `pending` rows and acks them
 * `done` or `failed`. This is how the UI drives a real container: the chaos
 * panel enqueues `kill`, the Reset button enqueues `restart`.
 */
export const agentCommands = createTable("agent_command", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  agentId: d
    .integer()
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  containerId: d
    .integer()
    .notNull()
    .references(() => containers.id, { onDelete: "cascade" }),
  /** kill · stop · start · restart */
  action: d.varchar({ length: 16 }).notNull(),
  /** pending · done · failed */
  status: d.varchar({ length: 16 }).default("pending").notNull(),
  result: d.varchar({ length: 1024 }),
  createdAt: d
    .timestamp({ withTimezone: true })
    .default(sql`NOW()`)
    .notNull(),
  completedAt: d.timestamp({ withTimezone: true }),
}));
