import { useCallback, useEffect, useRef } from "react";
import { daemonApiClient, type DaemonApiClient } from "../api/client";
import { connectDaemonEvents, type DaemonEventStreamController } from "./event-stream";
import { useDaemonEventStore } from "./event-store";

export function useDaemonEvents(client: DaemonApiClient = daemonApiClient, enabled = true) {
  const applyEvent = useDaemonEventStore((state) => state.applyEvent);
  const setConnectionState = useDaemonEventStore((state) => state.setConnectionState);
  const setError = useDaemonEventStore((state) => state.setError);
  const controllerRef = useRef<DaemonEventStreamController | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = connectDaemonEvents({
      client,
      onEvent: applyEvent,
      onState: setConnectionState,
      onError: setError,
    });
    controllerRef.current = controller;

    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, [applyEvent, client, enabled, setConnectionState, setError]);

  const reportActiveSession = useCallback((sessionId: string | null) => {
    controllerRef.current?.reportActiveSession(sessionId);
  }, []);

  return { reportActiveSession };
}
