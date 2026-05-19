import { useCallback, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Code2, Archive, Folder, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useProjectStore } from "../../stores/project-store";
import { useDaemonEventStore } from "../../daemon/events/event-store";
import { daemonApiClient } from "../../daemon/api/client";
import { getSessionModeMeta } from "../../shared/session-meta";
import type { ProjectEntry, SessionSummary } from "../../daemon/contracts";

interface LandingPageProps {
  onAddProject: () => void;
}

export function LandingPage({ onAddProject }: LandingPageProps) {
  const projects = useProjectStore((s) => s.projects);
  const sessions = useDaemonEventStore((s) => s.sessions);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const selectedProject = projects.find((p) => p.name === selected);

  const handleAction = useCallback(
    async (action: "review" | "archive") => {
      if (!selectedProject) return;
      setLoading(action);
      const result =
        action === "review"
          ? await daemonApiClient.createReviewSession(selectedProject.cwd)
          : await daemonApiClient.createArchiveSession(selectedProject.cwd);
      setLoading(null);
      if (result.ok) {
        void navigate({ to: "/s/$sessionId", params: { sessionId: result.data.session.id } });
      } else {
        toast.error(`Failed to start ${action}`, { description: result.error.message });
      }
    },
    [selectedProject, navigate],
  );

  return (
    <div className="isolate flex h-full flex-col bg-muted">
      <nav className="flex h-10 shrink-0 items-center gap-2 px-3">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-semibold">Plannotator</span>
      </nav>

      <div className="flex-1 overflow-hidden p-2 pt-0">
        <div className="h-full overflow-hidden rounded-xl bg-card shadow-[var(--card-shadow)]">
          <main className="flex h-full items-center justify-center overflow-auto">
            <div className="w-full max-w-xl px-6">
              {projects.length === 0 && sessions.length === 0 ? (
                <EmptyState onAddProject={onAddProject} />
              ) : (
                <div className="flex flex-col gap-8">
                  {projects.length > 0 && (
                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Select project
                      </span>
                      <ProjectTable
                        projects={projects}
                        selected={selected}
                        onSelect={setSelected}
                      />
                      <button
                        type="button"
                        onClick={onAddProject}
                        className="mt-2 inline-flex items-center gap-1.5 pl-3 text-[12px] text-muted-foreground hover:text-foreground"
                      >
                        <FolderPlus className="size-3.5" />
                        Add project
                      </button>

                      <div className="mt-6">
                        <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Launch
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!selectedProject || loading === "review"}
                            onClick={() => handleAction("review")}
                            className={cn(
                              "relative inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-[12px] font-medium transition-colors",
                              "hover:bg-surface-1 active:scale-[0.97]",
                              "disabled:pointer-events-none disabled:opacity-40",
                              "before:absolute before:-inset-1 before:content-['']",
                            )}
                          >
                            <Code2 className="size-3.5" />
                            {loading === "review" ? "Starting..." : "Code Review"}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedProject || loading === "archive"}
                            onClick={() => handleAction("archive")}
                            className={cn(
                              "relative inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-[12px] font-medium transition-colors",
                              "hover:bg-surface-1 active:scale-[0.97]",
                              "disabled:pointer-events-none disabled:opacity-40",
                              "before:absolute before:-inset-1 before:content-['']",
                            )}
                          >
                            <Archive className="size-3.5" />
                            {loading === "archive" ? "Opening..." : "Browse Archive"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {sessions.length > 0 && (
                    <div>
                      <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        Active sessions
                      </span>
                      <SessionList sessions={sessions} />
                    </div>
                  )}

                  {projects.length === 0 && (
                    <button
                      type="button"
                      onClick={onAddProject}
                      className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      <FolderPlus className="size-3.5" />
                      Add project to launch sessions
                    </button>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ProjectTable({
  projects,
  selected,
  onSelect,
}: {
  projects: ProjectEntry[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {projects.map((project, i) => (
        <button
          key={project.name}
          type="button"
          onClick={() => onSelect(project.name)}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors",
            i > 0 && "border-t border-border/40",
            selected === project.name
              ? "bg-primary/8 text-foreground"
              : "text-muted-foreground hover:bg-surface-1/50 hover:text-foreground",
          )}
        >
          <Folder className="size-3.5 shrink-0" />
          <span className="font-medium">{project.name}</span>
          <span className="ml-auto truncate text-[11px] opacity-60">{project.cwd}</span>
        </button>
      ))}
    </div>
  );
}

function SessionList({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      {sessions.map((session, i) => {
        const meta = getSessionModeMeta(session.mode);
        const Icon = meta.icon;
        return (
          <Link
            key={session.id}
            to="/s/$sessionId"
            params={{ sessionId: session.id }}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors",
              i > 0 && "border-t border-border/40",
              "text-muted-foreground hover:bg-surface-1/50 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0 text-primary" />
            <span className="font-medium">{session.label}</span>
            <span className="ml-auto text-[11px] opacity-60">{meta.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyState({ onAddProject }: { onAddProject: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h2 className="text-lg font-semibold">No projects yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Projects appear automatically when an agent creates a session, or you can add one manually.
      </p>
      <button
        type="button"
        onClick={onAddProject}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
      >
        <FolderPlus className="size-4" />
        Add project
      </button>
    </div>
  );
}
