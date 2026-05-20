import type {
  DaemonEndpoint,
  DaemonEvent,
  DaemonProjectEntry,
  DaemonSessionBootstrapResponse,
  DaemonSessionStatus,
  DaemonSessionSummary,
  DaemonSessionView,
  DaemonStatus,
  DaemonWebSocketServerMessage,
} from "@plannotator/shared/daemon-protocol";

export type SessionView = DaemonSessionView;
export type SessionMode = SessionView | (string & {});

export interface SessionSummary extends Omit<DaemonSessionSummary, "mode"> {
  mode: SessionMode;
}

export interface DaemonStatusSnapshot extends Omit<DaemonStatus, "endpoint"> {
  endpoint: DaemonEndpoint;
}

export interface SessionBootstrap extends Omit<DaemonSessionBootstrapResponse, "session"> {
  session: SessionSummary;
}

export interface SessionListResponse {
  ok: true;
  sessions: SessionSummary[];
}

export interface SessionResponse {
  ok: true;
  session: SessionSummary;
}

export interface DeleteSessionResponse {
  ok: true;
}

export type ProjectEntry = DaemonProjectEntry;

export interface ProjectListResponse {
  ok: true;
  projects: ProjectEntry[];
}

export interface WorktreeEntry {
  path: string;
  branch: string | null;
  head: string;
  lastActive: number;
}

export interface WorktreeListResponse {
  ok: true;
  worktrees: WorktreeEntry[];
}

export type SessionLifecycleStatus = DaemonSessionStatus;
export type DaemonServerMessage = DaemonWebSocketServerMessage;

export type DaemonLifecycleEvent =
  | (Omit<Extract<DaemonEvent, { type: "snapshot" }>, "sessions"> & {
      sessions: SessionSummary[];
    })
  | Extract<DaemonEvent, { type: "daemon-status" | "daemon-error" }>
  | Extract<DaemonEvent, { type: "debug-log" }>
  | (Omit<
      Extract<DaemonEvent, { type: "session-created" | "session-updated" | "session-removed" | "session-notify" }>,
      "session"
    > & {
      session: SessionSummary;
    });
