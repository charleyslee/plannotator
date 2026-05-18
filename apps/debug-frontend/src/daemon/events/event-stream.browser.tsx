import { describe, expect, test } from "vitest";
import { daemonStatusFixture, sessionListFixture } from "../../testing/fixtures/daemon";
import { connectDaemonEvents } from "./event-stream";
import type { WebSocketLike } from "./hub-client";

class FakeWebSocket implements WebSocketLike {
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onclose: WebSocketLike["onclose"] = null;
  onerror: WebSocketLike["onerror"] = null;
  readyState = 0;
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
    this.readyState = 3;
    this.onclose?.(new CloseEvent("close"));
  }
}

describe("daemon event browser transport", () => {
  test("uses one WebSocket and no EventSource for daemon runtime events", () => {
    const originalEventSource = globalThis.EventSource;
    let eventSourceConstructed = false;
    globalThis.EventSource = class extends EventTarget {
      constructor(_url: string | URL) {
        super();
        eventSourceConstructed = true;
      }

      close(): void {}
      onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
      onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
      onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
      readyState = 0;
      url = "";
      withCredentials = false;
      CONNECTING = 0;
      OPEN = 1;
      CLOSED = 2;
    } as unknown as typeof EventSource;

    try {
      const sockets: FakeWebSocket[] = [];
      const events: string[] = [];
      const controller = connectDaemonEvents({
        client: {
          getWebSocketUrl: () => "/daemon/ws",
          getStatus: async () => ({ ok: true, data: daemonStatusFixture }),
          listSessions: async () => ({ ok: true, data: sessionListFixture }),
        },
        webSocketFactory: () => {
          const socket = new FakeWebSocket();
          sockets.push(socket);
          return socket;
        },
        onEvent: (event) => events.push(event.type),
        onState: () => {},
        onError: (message) => events.push(message),
      });

      sockets[0].open();
      sockets[0].emit({
        type: "snapshot",
        at: "2026-05-17T12:00:00.000Z",
        scope: { family: "daemon" },
        payload: {
          status: daemonStatusFixture,
          sessions: sessionListFixture.sessions,
        },
      });

      controller.stop();

      expect(sockets).toHaveLength(1);
      expect(events).toEqual(["snapshot"]);
      expect(eventSourceConstructed).toBe(false);
    } finally {
      globalThis.EventSource = originalEventSource;
    }
  });
});
