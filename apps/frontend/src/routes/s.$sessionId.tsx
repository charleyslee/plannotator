import { createFileRoute } from "@tanstack/react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { SessionBootstrap } from "../daemon/contracts";
import type { DaemonApiResult } from "../daemon/api/errors";
import { getSessionModeMeta } from "../shared/session-meta";

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

export const Route = createFileRoute("/s/$sessionId")({
  params: {
    parse: ({ sessionId }) => {
      if (!SESSION_ID_PATTERN.test(sessionId)) return false;
      return { sessionId };
    },
    stringify: ({ sessionId }) => ({ sessionId }),
  },
  loader: ({ context, params }) => context.daemonClient.getSessionBootstrap(params.sessionId),
  component: SessionRoute,
});

function SessionRoute() {
  const result: DaemonApiResult<SessionBootstrap> = Route.useLoaderData();

  if (!result.ok) {
    return (
      <div className="isolate flex h-full flex-col bg-muted">
        <nav className="flex h-10 shrink-0 items-center gap-2 px-3">
          <SidebarTrigger className="-ml-1" />
        </nav>
        <div className="flex-1 overflow-hidden p-2 pt-0">
          <div className="flex h-full items-center justify-center rounded-xl bg-card shadow-[var(--card-shadow)]">
            <p className="text-sm text-muted-foreground">Session could not be loaded.</p>
          </div>
        </div>
      </div>
    );
  }

  const { session } = result.data;
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
