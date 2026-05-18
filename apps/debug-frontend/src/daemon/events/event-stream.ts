import type { DaemonApiClient } from "../api/client";
import type { DaemonApiResult } from "../api/errors";
import type {
  ShellDaemonEvent,
  ShellDaemonStatus,
  ShellDaemonWebSocketServerMessage,
  ShellSessionListResponse,
} from "../contracts";
import {
  getDaemonHubClient,
  type DaemonHubConnectionState,
  type WebSocketFactory,
} from "./hub-client";

export interface DaemonEventStreamOptions {
  client: Pick<DaemonApiClient, "getWebSocketUrl" | "getStatus" | "listSessions">;
  onEvent(event: ShellDaemonEvent): void;
  onState(state: DaemonHubConnectionState | "polling"): void;
  onError(message: string): void;
  webSocketFactory?: WebSocketFactory;
  fallbackPollMs?: number;
}

export interface DaemonEventStreamController {
  stop(): void;
}

const DAEMON_EVENT_TYPES = [
  "snapshot",
  "daemon-status",
  "session-created",
  "session-updated",
  "session-removed",
  "daemon-error",
  "debug-log",
] as const;
const DEFAULT_FALLBACK_POLL_MS = 2_000;

export function parseDaemonEventPayload(payload: unknown): ShellDaemonEvent | null {
  const value = payload as Partial<ShellDaemonEvent> | null;
  if (!value || typeof value !== "object" || typeof value.type !== "string") return null;
  if (!DAEMON_EVENT_TYPES.includes(value.type as (typeof DAEMON_EVENT_TYPES)[number])) return null;
  if (typeof value.at !== "string") return null;
  return value as ShellDaemonEvent;
}

export function connectDaemonEvents(
  options: DaemonEventStreamOptions,
): DaemonEventStreamController {
  let stopped = false;
  let pollingTimer: ReturnType<typeof setInterval> | undefined;
  let pollingInFlight = false;
  const client = getDaemonHubClient(options.client.getWebSocketUrl(), options.webSocketFactory);
  const fallbackPollMs = options.fallbackPollMs ?? DEFAULT_FALLBACK_POLL_MS;

  const emitSnapshot = async () => {
    if (stopped || pollingInFlight) return;
    pollingInFlight = true;
    let statusResult: DaemonApiResult<ShellDaemonStatus>;
    let sessionsResult: DaemonApiResult<ShellSessionListResponse>;
    try {
      [statusResult, sessionsResult] = await Promise.all([
        options.client.getStatus(),
        options.client.listSessions({ clean: true }),
      ]);
    } catch (err) {
      if (!stopped) {
        options.onError(err instanceof Error ? err.message : "Daemon polling failed.");
      }
      return;
    } finally {
      pollingInFlight = false;
    }
    if (stopped) return;
    emitPollingResult(statusResult, sessionsResult, {
      onEvent: options.onEvent,
      onError: options.onError,
      onState: options.onState,
    });
  };

  const unsubscribe = client.subscribeDaemon(
    (message) => {
      if (stopped) return;
      const event = messageToDaemonEvent(message);
      if (event) options.onEvent(event);
    },
    (state) => {
      if (stopped) return;
      options.onState(state);
      if (state === "open") stopPolling();
      if (state === "error" || state === "closed") startPolling();
    },
    (message) => {
      if (!stopped) options.onError(message);
    },
  );

  return { stop };

  function stop() {
    stopped = true;
    stopPolling();
    unsubscribe();
  }

  function startPolling(): void {
    if (stopped || pollingTimer) return;
    void emitSnapshot();
    pollingTimer = setInterval(() => {
      void emitSnapshot();
    }, fallbackPollMs);
    pollingTimer.unref?.();
  }

  function stopPolling(): void {
    if (!pollingTimer) return;
    clearInterval(pollingTimer);
    pollingTimer = undefined;
  }
}

function messageToDaemonEvent(message: ShellDaemonWebSocketServerMessage): ShellDaemonEvent | null {
  if (message.type === "snapshot" && message.scope.family === "daemon") {
    const payload = message.payload as {
      status?: ShellDaemonStatus;
      sessions?: ShellSessionListResponse["sessions"];
    };
    if (!payload.status || !Array.isArray(payload.sessions)) return null;
    return {
      type: "snapshot",
      at: message.at,
      status: payload.status,
      sessions: payload.sessions,
    };
  }
  if (message.type !== "event" || message.scope.family !== "daemon") return null;
  return parseDaemonEventPayload(message.payload);
}

function emitPollingResult(
  statusResult: DaemonApiResult<ShellDaemonStatus>,
  sessionsResult: DaemonApiResult<ShellSessionListResponse>,
  options: Pick<DaemonEventStreamOptions, "onEvent" | "onError" | "onState">,
): void {
  const at = new Date().toISOString();
  if (!statusResult.ok) {
    options.onError(statusResult.error.message);
    return;
  }

  options.onState("polling");

  if (!sessionsResult.ok) {
    options.onError(sessionsResult.error.message);
    options.onEvent({ type: "daemon-status", at, status: statusResult.data });
    return;
  }

  options.onEvent({
    type: "snapshot",
    at,
    status: statusResult.data,
    sessions: sessionsResult.data.sessions,
  });
}
