import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { daemonApiClient, type DaemonApiClient } from "../api/client";
import { connectDaemonEvents, type DaemonEventStreamController } from "./event-stream";
import { useDaemonEventStore } from "./event-store";

const MODE_LABELS: Record<string, string> = {
  plan: "Plan Review",
  review: "Code Review",
  annotate: "Annotate",
  archive: "Archive",
  "goal-setup": "Goal Setup",
};

export function useDaemonEvents(client: DaemonApiClient = daemonApiClient, enabled = true) {
  const applyEvent = useDaemonEventStore((state) => state.applyEvent);
  const setConnectionState = useDaemonEventStore((state) => state.setConnectionState);
  const setError = useDaemonEventStore((state) => state.setError);
  const controllerRef = useRef<DaemonEventStreamController | null>(null);
  const router = useRouter();

  const handleSessionNotify = useCallback(
    (session: { id: string; mode: string; project: string; label: string }) => {
      const modeLabel = MODE_LABELS[session.mode] ?? session.mode;
      toast(`${modeLabel} — ${session.project}`, {
        description: session.label,
        duration: 8000,
        action: {
          label: "Open",
          onClick: () => router.navigate({ to: "/s/$sessionId", params: { sessionId: session.id } }),
        },
      });
    },
    [router],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = connectDaemonEvents({
      client,
      onEvent: applyEvent,
      onState: setConnectionState,
      onError: setError,
      onSessionNotify: handleSessionNotify,
    });
    controllerRef.current = controller;

    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, [applyEvent, client, enabled, handleSessionNotify, setConnectionState, setError]);

  const reportActiveSession = useCallback((sessionId: string | null) => {
    controllerRef.current?.reportActiveSession(sessionId);
  }, []);

  return { reportActiveSession };
}
