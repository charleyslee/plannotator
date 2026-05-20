import { useCallback, useEffect } from "react";
import { Outlet, useMatchRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "../components/sidebar/AppSidebar";
import { AddProjectDialog } from "../components/landing/AddProjectDialog";
import { SessionSurface } from "../components/sessions/SessionSurface";
import { useDaemonEvents } from "../daemon/events/use-daemon-events";
import { projectStore } from "../stores/project-store";
import { useAppStore } from "../stores/app-store";

function LayoutContent() {
  const addProjectOpen = useAppStore((s) => s.addProjectOpen);
  const setAddProjectOpen = useAppStore((s) => s.setAddProjectOpen);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const visitedSessions = useAppStore((s) => s.visitedSessions);
  const matchRoute = useMatchRoute();
  const { open: sidebarOpen } = useSidebar();

  const { reportActiveSession } = useDaemonEvents();

  useEffect(() => {
    void projectStore.getState().fetchProjects();
  }, []);

  const isOnSession = !!matchRoute({ to: "/s/$sessionId", fuzzy: true });

  useEffect(() => {
    reportActiveSession(isOnSession ? activeSessionId : null);
  }, [reportActiveSession, isOnSession, activeSessionId]);
  const showLanding = !isOnSession;

  const openAddProject = useCallback(() => setAddProjectOpen(true), [setAddProjectOpen]);

  return (
    <>
      <AppSidebar onAddProject={openAddProject} />
      <main className="relative flex-1 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            visibility: showLanding ? "visible" : "hidden",
            zIndex: showLanding ? 1 : 0,
          }}
        >
          <Outlet />
        </div>

        {Object.values(visitedSessions).map(({ sessionId, bootstrap }) => (
          <div
            key={sessionId}
            className={`absolute inset-0 overflow-hidden ${sidebarOpen ? "rounded-tl-xl border-l border-border/50" : ""}`}
            style={{
              visibility: sessionId === activeSessionId && isOnSession ? "visible" : "hidden",
              zIndex: sessionId === activeSessionId && isOnSession ? 1 : 0,
            }}
          >
            <SessionSurface bootstrap={bootstrap} />
          </div>
        ))}
      </main>
      <AddProjectDialog open={addProjectOpen} onOpenChange={setAddProjectOpen} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            "--normal-bg": "var(--card)",
            "--normal-border": "var(--border)",
            "--normal-text": "var(--foreground)",
            "--normal-action-bg": "var(--primary)",
            "--normal-action-text": "var(--primary-foreground)",
          } as React.CSSProperties,
        }}
      />
    </>
  );
}

export function Layout() {
  const matchRoute = useMatchRoute();
  const initiallyOnSession = !!matchRoute({ to: "/s/$sessionId", fuzzy: true });

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <SidebarProvider
        defaultOpen={!initiallyOnSession}
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <LayoutContent />
      </SidebarProvider>
    </TooltipProvider>
  );
}
