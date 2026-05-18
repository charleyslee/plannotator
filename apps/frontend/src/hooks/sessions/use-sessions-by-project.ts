import { useMemo } from "react";
import type { SessionSummary } from "../../daemon/contracts";
import { useDaemonEventStore } from "../../daemon/events/event-store";

export function useSessionsByProject(): Map<string, SessionSummary[]> {
  const sessions = useDaemonEventStore((s) => s.sessions);
  return useMemo(() => {
    const map = new Map<string, SessionSummary[]>();
    for (const session of sessions) {
      const list = map.get(session.project) ?? [];
      list.push(session);
      map.set(session.project, list);
    }
    return map;
  }, [sessions]);
}
