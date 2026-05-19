import { useCallback, useEffect } from "react";
import { Outlet, useMatchRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "../components/sidebar/AppSidebar";
import { AddProjectDialog } from "../components/landing/AddProjectDialog";
import { SessionSurface } from "../components/sessions/SessionSurface";
import { useDaemonEvents } from "../daemon/events/use-daemon-events";
import { projectStore } from "../stores/project-store";
import { useAppStore, appStore } from "../stores/app-store";

export function Layout() {
  const addProjectOpen = useAppStore((s) => s.addProjectOpen);
  const setAddProjectOpen = useAppStore((s) => s.setAddProjectOpen);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const visitedSessions = useAppStore((s) => s.visitedSessions);
  const matchRoute = useMatchRoute();

  useDaemonEvents();

  useEffect(() => {
    void projectStore.getState().fetchProjects();
  }, []);

  const isOnSession = !!matchRoute({ to: "/s/$sessionId", fuzzy: true });
  useEffect(() => {
    if (!isOnSession && activeSessionId !== null) {
      appStore.getState().deactivateSession();
    }
  }, [isOnSession, activeSessionId]);

  const openAddProject = useCallback(() => setAddProjectOpen(true), [setAddProjectOpen]);

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <SidebarProvider
        defaultOpen={false}
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <AppSidebar onAddProject={openAddProject} />
        <main className="relative flex-1 overflow-hidden">
          {/* Landing page — visible when no session is active */}
          <div
            className="absolute inset-0"
            style={{
              visibility: activeSessionId === null ? "visible" : "hidden",
              zIndex: activeSessionId === null ? 1 : 0,
            }}
          >
            <Outlet />
          </div>

          {/* Each visited session stays alive — hidden via visibility, not display:none */}
          {Object.values(visitedSessions).map(({ sessionId, bootstrap }) => (
            <div
              key={sessionId}
              className="absolute inset-0"
              style={{
                visibility: sessionId === activeSessionId ? "visible" : "hidden",
                zIndex: sessionId === activeSessionId ? 1 : 0,
              }}
            >
              <SessionSurface bootstrap={bootstrap} />
            </div>
          ))}
        </main>
        <AddProjectDialog open={addProjectOpen} onOpenChange={setAddProjectOpen} />
        <Toaster position="bottom-right" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
