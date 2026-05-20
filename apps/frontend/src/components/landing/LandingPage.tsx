import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Code2, Archive, Folder, FolderPlus, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ASCII_BANNER } from "./ascii-banner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useProjectStore } from "../../stores/project-store";
import { useDaemonEventStore } from "../../daemon/events/event-store";
import { daemonApiClient } from "../../daemon/api/client";
import { getSessionModeMeta } from "../../shared/session-meta";
import type { ProjectEntry, SessionSummary, WorktreeEntry } from "../../daemon/contracts";

interface LandingPageProps {
  onAddProject: () => void;
}

interface Selection {
  cwd: string;
  label: string;
}

export function LandingPage({ onAddProject }: LandingPageProps) {
  const projects = useProjectStore((s) => s.projects);
  const sessions = useDaemonEventStore((s) => s.sessions);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAction = useCallback(
    async (action: "review" | "archive") => {
      if (!selected) return;
      setLoading(action);
      const result =
        action === "review"
          ? await daemonApiClient.createReviewSession(selected.cwd)
          : await daemonApiClient.createArchiveSession(selected.cwd);
      setLoading(null);
      if (result.ok) {
        void navigate({ to: "/s/$sessionId", params: { sessionId: result.data.session.id } });
      } else {
        toast.error(`Failed to start ${action}`, { description: result.error.message });
      }
    },
    [selected, navigate],
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
            <div className="w-full max-w-2xl px-6">
              <pre className="mb-8 overflow-x-auto text-[5px] leading-[1.2] text-foreground/70 sm:text-[6px] md:text-[7px]" aria-hidden="true">
                {ASCII_BANNER}
              </pre>

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
                        selectedCwd={selected?.cwd ?? null}
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
                            disabled={!selected || loading === "review"}
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
                            disabled={!selected || loading === "archive"}
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
  selectedCwd,
  onSelect,
}: {
  projects: ProjectEntry[];
  selectedCwd: string | null;
  onSelect: (selection: Selection) => void;
}) {
  const topLevel = projects.filter((p) => !p.parentCwd);
  const worktreeChildren = (parentCwd: string) =>
    projects.filter((p) => p.parentCwd === parentCwd);

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60">
      {topLevel.map((project, i) => {
        const children = worktreeChildren(project.cwd);
        return (
          <ProjectNode
            key={project.cwd}
            project={project}
            children={children}
            isFirst={i === 0}
            selectedCwd={selectedCwd}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

function ProjectNode({
  project,
  children,
  isFirst,
  selectedCwd,
  onSelect,
}: {
  project: ProjectEntry;
  children: ProjectEntry[];
  isFirst: boolean;
  selectedCwd: string | null;
  onSelect: (selection: Selection) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [worktrees, setWorktrees] = useState<WorktreeEntry[]>([]);
  const [worktreesFetched, setWorktreesFetched] = useState(false);
  const hasChildren = children.length > 0;

  useEffect(() => {
    if (worktreesFetched) return;
    setWorktreesFetched(true);
    daemonApiClient.listWorktrees(project.cwd).then((result) => {
      if (result.ok) {
        setWorktrees(result.data.worktrees.filter((wt) => wt.path !== project.cwd));
      }
    });
  }, [project.cwd, worktreesFetched]);

  const hasWorktrees = hasChildren || worktrees.length > 0;

  const isSelected = selectedCwd === project.cwd;

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect({ cwd: project.cwd, label: project.name })}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors",
          !isFirst && "border-t border-border/40",
          isSelected
            ? "bg-primary/8 text-foreground"
            : "text-muted-foreground hover:bg-surface-1/50 hover:text-foreground",
        )}
      >
        <Folder className="size-3.5 shrink-0" />
        <span className="font-medium">{project.name}</span>
        {project.branch && (
          <span className="text-[11px] opacity-60">{project.branch}</span>
        )}
        <span className="ml-auto truncate text-[11px] opacity-60">{project.cwd}</span>
        {hasWorktrees && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:bg-surface-1 hover:text-foreground"
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </span>
        )}
      </button>

      {expanded && (
        <>
          <div className="border-t border-border/40 py-1.5 pl-9 pr-3">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">Worktrees</span>
          </div>
          {children.map((child) => (
            <button
              key={child.cwd}
              type="button"
              onClick={() => onSelect({ cwd: child.cwd, label: `${project.name} / ${child.branch ?? child.name}` })}
              className={cn(
                "flex w-full items-center gap-2 border-t border-border/40 py-2 pl-9 pr-3 text-left text-[13px] transition-colors",
                selectedCwd === child.cwd
                  ? "bg-primary/8 text-foreground"
                  : "text-muted-foreground hover:bg-surface-1/50 hover:text-foreground",
              )}
            >
              <span className="font-medium">{child.branch ?? child.name}</span>
              <span className="ml-auto truncate text-[11px] opacity-60">{child.cwd}</span>
            </button>
          ))}
          {worktrees.map((wt) => {
            if (children.some((c) => c.cwd === wt.path)) return null;
            return (
              <button
                key={wt.path}
                type="button"
                onClick={() => onSelect({ cwd: wt.path, label: `${project.name} / ${wt.branch ?? "detached"}` })}
                className={cn(
                  "flex w-full items-center gap-2 border-t border-border/40 py-2 pl-9 pr-3 text-left text-[13px] transition-colors",
                  selectedCwd === wt.path
                    ? "bg-primary/8 text-foreground"
                    : "text-muted-foreground hover:bg-surface-1/50 hover:text-foreground",
                )}
              >
                <span className="font-medium">{wt.branch ?? "detached"}</span>
                <span className="ml-auto truncate text-[11px] opacity-60">{wt.path}</span>
              </button>
            );
          })}
        </>
      )}
    </>
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
