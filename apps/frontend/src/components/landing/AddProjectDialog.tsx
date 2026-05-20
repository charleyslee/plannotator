import { useCallback, useEffect, useRef, useState } from "react";
import { Folder, ChevronRight, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "../../stores/project-store";
import { daemonApiClient } from "../../daemon/api/client";
import type { DirectoryEntry, ProjectEntry } from "../../daemon/contracts";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const [query, setQuery] = useState("~");
  const [resolvedPath, setResolvedPath] = useState("");
  const [dirs, setDirs] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const projects = useProjectStore((s) => s.projects);
  const addProject = useProjectStore((s) => s.addProject);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const recentProjects = projects.slice(0, 5);

  const fetchDirs = useCallback(async (path: string) => {
    setLoading(true);
    const result = await daemonApiClient.listDirectories(path);
    if (result.ok) {
      setResolvedPath(result.data.path);
      setDirs(result.data.dirs);
    } else {
      setDirs([]);
    }
    setLoading(false);
    setActiveIndex(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("~");
    setDirs([]);
    setResolvedPath("");
    setActiveIndex(0);
    fetchDirs("~");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, fetchDirs]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (query.trim()) fetchDirs(query.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open, fetchDirs]);

  const handleSelect = useCallback(
    async (path: string) => {
      setAdding(true);
      const result = await addProject(path);
      setAdding(false);
      if (result) {
        onOpenChange(false);
      }
    },
    [addProject, onOpenChange],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      const display = path.replace(resolvedPath === "/" ? "" : resolvedPath, resolvedPath === "/" ? "/" : "");
      setQuery(resolvedPath === "/" ? path : path.replace(/.*\//, resolvedPath + "/"));
      setQuery(path);
      fetchDirs(path);
    },
    [resolvedPath, fetchDirs],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const totalItems = recentProjects.length + dirs.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
      } else if (e.key === "Tab" && !e.shiftKey && dirs.length > 0) {
        e.preventDefault();
        const dirIndex = activeIndex - recentProjects.length;
        if (dirIndex >= 0 && dirIndex < dirs.length) {
          handleNavigate(dirs[dirIndex].path);
        } else if (dirs.length > 0) {
          handleNavigate(dirs[0].path);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex < recentProjects.length) {
          handleSelect(recentProjects[activeIndex].cwd);
        } else {
          const dirIndex = activeIndex - recentProjects.length;
          if (dirIndex >= 0 && dirIndex < dirs.length) {
            handleSelect(dirs[dirIndex].path);
          } else if (resolvedPath) {
            handleSelect(resolvedPath);
          }
        }
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [activeIndex, dirs, recentProjects, resolvedPath, handleNavigate, handleSelect, onOpenChange],
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const shortenPath = (p: string) =>
    resolvedPath && p.startsWith(resolvedPath)
      ? p.slice(resolvedPath.length + 1) || p
      : p;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 pt-[15vh] backdrop-blur-[2px]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/70 bg-popover text-popover-foreground shadow-[0_24px_80px_-36px_rgba(15,23,42,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
          <Folder className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="~/work/project or search..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50"
          />
          {adding && <span className="text-[11px] text-muted-foreground">Adding...</span>}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto">
          {recentProjects.length > 0 && (
            <div className="px-2 pt-2">
              <span className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Recent
              </span>
              {recentProjects.map((project, i) => (
                <ProjectRow
                  key={project.cwd}
                  project={project}
                  active={activeIndex === i}
                  index={i}
                  onSelect={() => handleSelect(project.cwd)}
                  onHover={() => setActiveIndex(i)}
                />
              ))}
            </div>
          )}

          <div className="px-2 pb-2 pt-1">
            {recentProjects.length > 0 && dirs.length > 0 && (
              <span className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Directories
              </span>
            )}
            {dirs.map((dir, i) => {
              const idx = recentProjects.length + i;
              return (
                <DirectoryRow
                  key={dir.path}
                  dir={dir}
                  displayName={shortenPath(dir.path)}
                  active={activeIndex === idx}
                  index={idx}
                  onSelect={() => handleSelect(dir.path)}
                  onNavigate={() => handleNavigate(dir.path)}
                  onHover={() => setActiveIndex(idx)}
                />
              );
            })}
            {!loading && dirs.length === 0 && recentProjects.length === 0 && (
              <div className="px-2 py-4 text-center text-[12px] text-muted-foreground/60">
                No directories found
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" /> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 px-1 text-[10px]">Tab</kbd> navigate into
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/50 px-1 text-[10px]">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  active,
  index,
  onSelect,
  onHover,
}: {
  project: ProjectEntry;
  active: boolean;
  index: number;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      data-index={index}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Folder className="size-3.5 shrink-0" />
      <span className="font-medium">{project.name}</span>
      <span className="ml-auto truncate text-[11px] opacity-50">{project.cwd.replace(/^\/Users\/[^/]+/, "~")}</span>
    </button>
  );
}

function DirectoryRow({
  dir,
  displayName,
  active,
  index,
  onSelect,
  onNavigate,
  onHover,
}: {
  dir: DirectoryEntry;
  displayName: string;
  active: boolean;
  index: number;
  onSelect: () => void;
  onNavigate: () => void;
  onHover: () => void;
}) {
  return (
    <button
      type="button"
      data-index={index}
      onClick={onSelect}
      onDoubleClick={onNavigate}
      onMouseEnter={onHover}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Folder className="size-3.5 shrink-0" />
      <span className="font-medium">{dir.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate();
        }}
        className="ml-auto rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-1"
        title="Navigate into"
      >
        <ChevronRight className="size-3" />
      </button>
    </button>
  );
}
