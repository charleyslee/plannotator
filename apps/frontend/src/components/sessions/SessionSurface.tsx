import { useEffect } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SessionProvider } from "@plannotator/ui/hooks/useSessionFetch";
import { ReviewAppEmbedded } from "@plannotator/code-review";
import "@plannotator/code-review/styles";
import type { SessionBootstrap } from "../../daemon/contracts";
import { getSessionModeMeta } from "../../shared/session-meta";

interface SessionSurfaceProps {
  bootstrap: SessionBootstrap;
}

export function SessionSurface({ bootstrap }: SessionSurfaceProps) {
  // Activity cleans up effects when hidden and re-runs them when visible.
  // This fires on mount and on each hidden→visible transition, kicking
  // resize observers so virtualized content (Pierre diffs, Dockview)
  // recalculates its layout after being in display:none.
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, []);
  const { session } = bootstrap;

  if (session.mode === "review") {
    return (
      <SessionProvider sessionId={session.id}>
        <ReviewAppEmbedded
          headerLeft={
            <SidebarTrigger className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" />
          }
        />
      </SessionProvider>
    );
  }

  const meta = getSessionModeMeta(session.mode);
  const Icon = meta.icon;

  return (
    <div className="isolate flex h-full flex-col bg-muted">
      <nav className="flex h-10 shrink-0 items-center gap-2 px-3">
        <SidebarTrigger className="-ml-1" />
        <Icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{session.label}</span>
        <span className="rounded-full bg-surface-1 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {session.status}
        </span>
      </nav>

      <div className="flex-1 overflow-hidden p-2 pt-0">
        <div className="h-full overflow-hidden rounded-xl bg-card shadow-[var(--card-shadow)]">
          <main className="h-full scroll-smooth overflow-auto">
            <div className="mx-auto w-full max-w-3xl px-6 py-8 md:py-10">
              <p className="text-sm text-muted-foreground">
                {meta.label} surface · {session.project} · {session.id}
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
