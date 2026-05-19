import { SidebarTrigger } from "@/components/ui/sidebar";
import { SessionProvider } from "@plannotator/ui/hooks/useSessionFetch";
import { ReviewAppEmbedded } from "@plannotator/code-review";
import { PlanAppEmbedded } from "@plannotator/plan-review";
import "@plannotator/code-review/styles";
import "@plannotator/plan-review/styles";
import type { SessionBootstrap } from "../../daemon/contracts";

const sidebarTrigger = (
  <SidebarTrigger className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" />
);

interface SessionSurfaceProps {
  bootstrap: SessionBootstrap;
}

export function SessionSurface({ bootstrap }: SessionSurfaceProps) {
  const { session } = bootstrap;

  if (session.mode === "review") {
    return (
      <SessionProvider sessionId={session.id}>
        <ReviewAppEmbedded headerLeft={sidebarTrigger} />
      </SessionProvider>
    );
  }

  // plan, annotate, archive, goal-setup — all handled by the plan review component
  return (
    <SessionProvider sessionId={session.id}>
      <PlanAppEmbedded headerLeft={sidebarTrigger} />
    </SessionProvider>
  );
}
