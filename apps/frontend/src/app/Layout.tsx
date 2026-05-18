import { useCallback, useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../components/sidebar/AppSidebar";
import { AddProjectDialog } from "../components/landing/AddProjectDialog";
import { useDaemonEvents } from "../daemon/events/use-daemon-events";
import { projectStore } from "../stores/project-store";
import { useAppStore } from "../stores/app-store";

export function Layout() {
  const addProjectOpen = useAppStore((s) => s.addProjectOpen);
  const setAddProjectOpen = useAppStore((s) => s.setAddProjectOpen);

  useDaemonEvents();

  useEffect(() => {
    void projectStore.getState().fetchProjects();
  }, []);

  const openAddProject = useCallback(() => setAddProjectOpen(true), [setAddProjectOpen]);

  return (
    <SidebarProvider
      defaultOpen={false}
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      <AppSidebar onAddProject={openAddProject} />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <AddProjectDialog open={addProjectOpen} onOpenChange={setAddProjectOpen} />
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}
