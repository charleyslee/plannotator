import { describe, expect, test } from "vitest";
import { createDaemonErrorResponse } from "@plannotator/shared/daemon-protocol";
import { sessionBootstrap, sessionListFixture } from "../../testing/fixtures/daemon";
import { createFixtureFetch } from "../../testing/fetch";
import { createDaemonApiClient } from "./client";
import type { WebSocketLike } from "../events/hub-client";

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
    const message = JSON.parse(data);
    if (message.type === "action") {
      queueMicrotask(() => {
        this.onmessage?.({
          data: JSON.stringify({
            type: "action-result",
            requestId: message.requestId,
            ok: true,
            status: 200,
            payload: { ok: true, action: message.path },
          }),
        } as MessageEvent<string>);
      });
    }
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
}

describe("daemon API client", () => {
  test("loads daemon session bootstrap through the session-scoped API base", async () => {
    const bootstrap = sessionBootstrap("plan", 1);
    const fixture = createFixtureFetch({
      "/s/plan-session-1/api/session": bootstrap,
    });
    const client = createDaemonApiClient({ fetch: fixture.fetch });

    const result = await client.getSessionBootstrap("plan-session-1");

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.apiBase).toBe("/s/plan-session-1/api");
    expect(fixture.requests).toEqual([{ url: "/s/plan-session-1/api/session", init: undefined }]);
    expect(fixture.requests[0].url).not.toBe("/api/session");
  });

  test("lists sessions from the daemon control plane", async () => {
    const fixture = createFixtureFetch({
      "/daemon/sessions?clean=1": sessionListFixture,
    });
    const client = createDaemonApiClient({ fetch: fixture.fetch });

    const result = await client.listSessions({ clean: true });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.sessions).toHaveLength(5);
  });

  test("builds daemon event and session-scoped API URLs", () => {
    const client = createDaemonApiClient({ baseUrl: "http://127.0.0.1:19432/root/" });

    expect(client.getWebSocketUrl()).toBe("ws://127.0.0.1:19432/daemon/ws");
    expect(client.getSessionApiUrl("plan-session_1", "/api/plan")).toBe(
      "http://127.0.0.1:19432/s/plan-session_1/api/plan",
    );
  });

  test("builds an absolute default WebSocket URL", () => {
    const client = createDaemonApiClient();

    expect(client.getWebSocketUrl()).toBe("ws://localhost/daemon/ws");
  });

  test("runs debug session actions through the session-scoped API", async () => {
    const socket = new FakeWebSocket();
    const client = createDaemonApiClient({ webSocketFactory: () => socket });
    queueMicrotask(() => socket.open());

    const result = await client.runSessionAction(
      {
        id: "review-session-1",
        mode: "review",
        status: "active",
        url: "http://127.0.0.1/s/review-session-1",
        project: "plannotator",
        label: "Review",
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      "review-approve",
    );

    expect(result.ok).toBe(true);
    expect(socket.sent).toHaveLength(1);
    const message = JSON.parse(socket.sent[0]);
    expect(message).toMatchObject({
      type: "action",
      sessionId: "review-session-1",
      method: "POST",
      path: "/api/feedback",
    });
    expect(message.body).toMatchObject({
      approved: true,
      feedback: "LGTM",
      annotations: [],
    });
    expect(socket.closed).toBe(true);
  });

  test("preserves WebSocket action error payloads", async () => {
    const socket = new FakeWebSocket();
    socket.send = (data: string) => {
      socket.sent.push(data);
      const message = JSON.parse(data);
      queueMicrotask(() => {
        socket.onmessage?.({
          data: JSON.stringify({
            type: "action-result",
            requestId: message.requestId,
            ok: true,
            status: 422,
            payload: { error: "Review feedback is required." },
          }),
        } as MessageEvent<string>);
      });
    };
    const client = createDaemonApiClient({ webSocketFactory: () => socket });
    queueMicrotask(() => socket.open());

    const result = await client.runSessionAction(
      {
        id: "review-session-1",
        mode: "review",
        status: "active",
        url: "http://127.0.0.1/s/review-session-1",
        project: "plannotator",
        label: "Review",
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      "review-approve",
    );

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "http-error",
        status: 422,
        message: "Review feedback is required.",
        payload: { error: "Review feedback is required." },
      },
    });
  });

  test("falls back to HTTP when the action socket cannot open", async () => {
    const fixture = createFixtureFetch({
      "/s/review-session-1/api/feedback": { ok: true, via: "http" },
    });
    const client = createDaemonApiClient({
      fetch: fixture.fetch,
      webSocketFactory: () => {
        throw new Error("websocket unavailable");
      },
    });

    const result = await client.runSessionAction(
      {
        id: "review-session-1",
        mode: "review",
        status: "active",
        url: "http://127.0.0.1/s/review-session-1",
        project: "plannotator",
        label: "Review",
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      "review-approve",
    );

    expect(result).toEqual({ ok: true, data: { ok: true, via: "http" } });
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.requests[0].url).toBe("/s/review-session-1/api/feedback");
  });

  test("falls back to HTTP when the daemon action socket rejects missing auth", async () => {
    const fixture = createFixtureFetch({
      "/s/review-session-1/api/feedback": { ok: true, via: "http" },
    });
    const socket = new FakeWebSocket();
    socket.send = (data: string) => {
      socket.sent.push(data);
      const message = JSON.parse(data);
      queueMicrotask(() => {
        socket.onmessage?.({
          data: JSON.stringify({
            type: "error",
            requestId: message.requestId,
            code: "unauthorized",
            message: "Daemon WebSocket actions require authentication.",
          }),
        } as MessageEvent<string>);
      });
    };
    const client = createDaemonApiClient({
      fetch: fixture.fetch,
      webSocketFactory: () => socket,
    });
    queueMicrotask(() => socket.open());

    const result = await client.runSessionAction(
      {
        id: "review-session-1",
        mode: "review",
        status: "active",
        url: "http://127.0.0.1/s/review-session-1",
        project: "plannotator",
        label: "Review",
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      "review-approve",
    );

    expect(result).toEqual({ ok: true, data: { ok: true, via: "http" } });
    expect(socket.sent).toHaveLength(1);
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.requests[0].url).toBe("/s/review-session-1/api/feedback");
  });

  test("does not fall back after a WebSocket action was sent", async () => {
    const fixture = createFixtureFetch({
      "/s/review-session-1/api/feedback": { ok: true, via: "http" },
    });
    const socket = new FakeWebSocket();
    socket.send = (data: string) => {
      socket.sent.push(data);
      queueMicrotask(() => socket.close());
    };
    const client = createDaemonApiClient({
      fetch: fixture.fetch,
      webSocketFactory: () => socket,
    });
    queueMicrotask(() => socket.open());

    const result = await client.runSessionAction(
      {
        id: "review-session-1",
        mode: "review",
        status: "active",
        url: "http://127.0.0.1/s/review-session-1",
        project: "plannotator",
        label: "Review",
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      "review-approve",
    );

    expect(result.ok).toBe(false);
    expect(socket.sent).toHaveLength(1);
    expect(fixture.requests).toHaveLength(0);
  });

  test("falls back to HTTP when the socket closes before the action is sent", async () => {
    const fixture = createFixtureFetch({
      "/s/review-session-1/api/feedback": { ok: true, via: "http" },
    });
    const socket = new FakeWebSocket();
    socket.open = () => {
      socket.readyState = 1;
      socket.onopen?.(new Event("open"));
      socket.readyState = 3;
    };
    const client = createDaemonApiClient({
      fetch: fixture.fetch,
      webSocketFactory: () => socket,
    });
    queueMicrotask(() => socket.open());

    const result = await client.runSessionAction(
      {
        id: "review-session-1",
        mode: "review",
        status: "active",
        url: "http://127.0.0.1/s/review-session-1",
        project: "plannotator",
        label: "Review",
        createdAt: "2026-05-17T00:00:00.000Z",
        updatedAt: "2026-05-17T00:00:00.000Z",
      },
      "review-approve",
    );

    expect(result).toEqual({ ok: true, data: { ok: true, via: "http" } });
    expect(socket.sent).toHaveLength(0);
    expect(fixture.requests).toHaveLength(1);
  });

  test("normalizes daemon error responses", async () => {
    const fixture = createFixtureFetch({
      "/s/missing-session/api/session": Response.json(
        createDaemonErrorResponse("session-not-found", "Session not found."),
        { status: 404 },
      ),
    });
    const client = createDaemonApiClient({ fetch: fixture.fetch });

    const result = await client.getSessionBootstrap("missing-session");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("daemon-error");
    expect(!result.ok && result.error.message).toBe("Session not found.");
  });

  test("normalizes malformed JSON", async () => {
    const fixture = createFixtureFetch({
      "/daemon/sessions": new Response("not json", { status: 200 }),
    });
    const client = createDaemonApiClient({ fetch: fixture.fetch });

    const result = await client.listSessions();

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("invalid-json");
  });

  test("normalizes network failures", async () => {
    const client = createDaemonApiClient({
      fetch: (async () => {
        throw new Error("connection refused");
      }) as typeof fetch,
    });

    const result = await client.listSessions();

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("network-error");
    expect(!result.ok && result.error.message).toContain("connection refused");
  });

  test("rejects malformed success payloads", async () => {
    const fixture = createFixtureFetch({
      "/s/plan-session-1/api/session": { ok: true, session: { id: "plan-session-1" } },
    });
    const client = createDaemonApiClient({ fetch: fixture.fetch });

    const result = await client.getSessionBootstrap("plan-session-1");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("invalid-payload");
  });
});
