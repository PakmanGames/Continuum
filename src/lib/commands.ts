/** The command queue's vocabulary, shared by the API, the UI and the agent. */

export const COMMAND_ACTIONS = ["kill", "stop", "start", "restart"] as const;
export type CommandAction = (typeof COMMAND_ACTIONS)[number];

export const COMMAND_STATUSES = ["pending", "done", "failed"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

/** A queued command as the API returns it. Timestamps are ISO strings. */
export type AgentCommand = {
  id: number;
  agentId: number;
  containerId: number;
  containerName: string;
  action: CommandAction;
  status: CommandStatus;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
};
