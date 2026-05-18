import { describe, expect, test } from "vitest";
import { daemonStatusFixture, sessionListFixture } from "../../testing/fixtures/daemon";
import { connectDaemonEvents, parseDaemonEventPayload } from "./event-stream";
import { DaemonHubClient, type WebSocketLike } from "./hub-client";

class FakeWebSocket implements WebSocketLike {
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onclose: WebSocketLike["onclose"] = null;
  onerror: WebSocketLike["onerror"] = null;
  readyState = 0;
  closed = false;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  emit(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close"));
  }

  error(): void {
    this.readyState = 3;
    this.onerror?.(new Event("error"));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("daemon WebSocket event client", () => {
  test("parses daemon event payloads defensively", () => {
    const event = parseDaemonEventPayload({
      type: "daemon-status",
      at: "2026-05-17T12:00:00.000Z",
      status: daemonStatusFixture,
    });

    expect(event?.type).toBe("daemon-status");
    expect(
      parseDaemonEventPayload({
        type: "debug-log",
        at: "2026-05-17T12:00:00.000Z",
        source: "agent-simulator",
        message: "queued claude-plan-hook",
      })?.type,
    ).toBe("debug-log");
    expect(parseDaemonEventPayload("not json")).toBeNull();
    expect(parseDaemonEventPayload({ type: "unknown", at: "now" })).toBeNull();
  });

  test("subscribes to daemon events over WebSocket", () => {
    const events: string[] = [];
    const states: string[] = [];
    const socket = new FakeWebSocket();

    const controller = connectDaemonEvents({
      client: {
        getWebSocketUrl: () => "/daemon/ws",
        getStatus: async () => ({ ok: true, data: daemonStatusFixture }),
        listSessions: async () => ({ ok: true, data: sessionListFixture }),
      },
      webSocketFactory: () => socket,
      onEvent: (event) => events.push(event.type),
      onState: (state) => states.push(state),
      onError: (message) => events.push(message),
    });

    socket.open();
    socket.emit({
      type: "snapshot",
      at: "2026-05-17T12:00:00.000Z",
      scope: { family: "daemon" },
      payload: {
        status: daemonStatusFixture,
        sessions: sessionListFixture.sessions,
      },
    });
    socket.emit({
      type: "event",
      at: "2026-05-17T12:00:01.000Z",
      scope: { family: "daemon" },
      payload: {
        type: "daemon-status",
        at: "2026-05-17T12:00:01.000Z",
        status: daemonStatusFixture,
      },
    });
    controller.stop();

    expect(states).toEqual(["connecting", "open"]);
    expect(events).toEqual(["snapshot", "daemon-status"]);
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: "subscribe",
      scopes: [{ family: "daemon" }],
    });
    expect(socket.closed).toBe(true);
  });

  test("resyncs daemon snapshot when the socket closes", async () => {
    const events: string[] = [];
    const states: string[] = [];
    const socket = new FakeWebSocket();

    const controller = connectDaemonEvents({
      client: {
        getWebSocketUrl: () => "/daemon/ws",
        getStatus: async () => ({ ok: true, data: daemonStatusFixture }),
        listSessions: async () => ({ ok: true, data: sessionListFixture }),
      },
      webSocketFactory: () => socket,
      onEvent: (event) => events.push(event.type),
      onState: (state) => states.push(state),
      onError: (message) => events.push(message),
    });

    socket.open();
    socket.close();
    await Promise.resolve();
    await Promise.resolve();
    controller.stop();

    expect(states).toContain("polling");
    expect(events).toContain("snapshot");
  });

  test("falls back to polling when the daemon subscription is rejected", async () => {
    const events: string[] = [];
    const states: string[] = [];
    const socket = new FakeWebSocket();
    let statusCalls = 0;

    const controller = connectDaemonEvents({
      client: {
        getWebSocketUrl: () => "/daemon/ws",
        getStatus: async () => {
          statusCalls += 1;
          return { ok: true, data: daemonStatusFixture };
        },
        listSessions: async () => ({ ok: true, data: sessionListFixture }),
      },
      webSocketFactory: () => socket,
      onEvent: (event) => events.push(event.type),
      onState: (state) => states.push(state),
      onError: (message) => events.push(message),
    });

    socket.open();
    socket.emit({
      type: "error",
      code: "unauthorized",
      message: "Daemon event subscriptions require authentication.",
    });
    await Promise.resolve();
    await Promise.resolve();
    controller.stop();

    expect(states).toContain("error");
    expect(states).toContain("polling");
    expect(events).toContain("Daemon event subscriptions require authentication.");
    expect(events).toContain("snapshot");
    expect(statusCalls).toBeGreaterThan(0);
  });

  test("rejects pending actions when an uncorrelated daemon error closes the shared socket", async () => {
    const socket = new FakeWebSocket();
    const client = new DaemonHubClient("ws://localhost/daemon/ws", () => socket);
    const unsubscribe = client.subscribeDaemon(
      () => {},
      () => {},
      () => {},
    );

    socket.open();
    const action = client.runAction({
      sessionId: "review-session-1",
      method: "POST",
      path: "/api/feedback",
      body: { approved: true },
    });
    await Promise.resolve();
    expect(socket.sent.map((message) => JSON.parse(message).type)).toEqual(["subscribe", "action"]);

    socket.emit({
      type: "error",
      code: "unauthorized",
      message: "Daemon event subscriptions require authentication.",
    });

    await expect(action).rejects.toThrow("Daemon event subscriptions require authentication.");
    unsubscribe();
  });

  test("keeps polling while the daemon WebSocket transport is unavailable", async () => {
    const events: string[] = [];
    const states: string[] = [];
    let statusCalls = 0;
    let sessionCalls = 0;

    const controller = connectDaemonEvents({
      client: {
        getWebSocketUrl: () => "ws://localhost/daemon/ws?polling-fallback",
        getStatus: async () => {
          statusCalls += 1;
          return { ok: true, data: daemonStatusFixture };
        },
        listSessions: async () => {
          sessionCalls += 1;
          return { ok: true, data: sessionListFixture };
        },
      },
      webSocketFactory: () => {
        throw new Error("WebSocket upgrades blocked");
      },
      fallbackPollMs: 5,
      onEvent: (event) => events.push(event.type),
      onState: (state) => states.push(state),
      onError: (message) => events.push(message),
    });

    await sleep(25);
    controller.stop();

    expect(statusCalls).toBeGreaterThan(1);
    expect(sessionCalls).toBeGreaterThan(1);
    expect(states).toContain("polling");
    expect(events).toContain("snapshot");
  });

  test("ignores stale close events after reconnecting an errored socket", async () => {
    const sockets: FakeWebSocket[] = [];
    const states: string[] = [];
    const client = new DaemonHubClient("ws://localhost/daemon/ws", () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    });

    const unsubscribe = client.subscribeDaemon(
      () => {},
      (state) => states.push(state),
      () => {},
    );

    sockets[0].error();
    await sleep(550);
    expect(sockets).toHaveLength(2);

    sockets[0].close();
    sockets[1].open();

    expect(states).toContain("open");
    expect(JSON.parse(sockets[1].sent[0])).toEqual({
      type: "subscribe",
      scopes: [{ family: "daemon" }],
    });

    unsubscribe();
  });

  test("can reopen after the last subscriber unsubscribes during connect", async () => {
    const sockets: FakeWebSocket[] = [];
    const errors: string[] = [];
    const client = new DaemonHubClient("ws://localhost/daemon/ws", () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    });

    const firstUnsubscribe = client.subscribeDaemon(
      () => {},
      () => {},
      (message) => errors.push(message),
    );
    firstUnsubscribe();
    await Promise.resolve();

    const secondUnsubscribe = client.subscribeDaemon(
      () => {},
      () => {},
      (message) => errors.push(message),
    );
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(JSON.parse(sockets[1].sent[0])).toEqual({
      type: "subscribe",
      scopes: [{ family: "daemon" }],
    });

    secondUnsubscribe();
    expect(errors).toEqual([]);
  });
});
