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

  // Derive visibility from the route synchronously — no async effect needed.
  // activeSessionId tells us which session surface to show.
  // isOnSession tells us if we're on a session route at all (controls Outlet visibility).
  const isOnSession = !!matchRoute({ to: "/s/$sessionId", fuzzy: true });
  const showLanding = !isOnSession;

  const openAddProject = useCallback(() => setAddProjectOpen(true), [setAddProjectOpen]);

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <SidebarProvider
        defaultOpen={false}
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
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
              className="absolute inset-0 overflow-hidden peer-data-[state=expanded]:rounded-tl-xl peer-data-[state=expanded]:border-l peer-data-[state=expanded]:border-border/50"
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
            } as React.CSSProperties,
          }}
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}
