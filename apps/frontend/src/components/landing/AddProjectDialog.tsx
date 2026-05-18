import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "../../stores/project-store";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProjectDialog({ open, onOpenChange }: AddProjectDialogProps) {
  const [cwd, setCwd] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const addProject = useProjectStore((s) => s.addProject);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCwd("");
      setName("");
      setError(undefined);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, onOpenChange]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!cwd.trim()) return;
      setLoading(true);
      setError(undefined);
      const result = await addProject(cwd.trim(), name.trim() || undefined);
      setLoading(false);
      if (result) {
        onOpenChange(false);
      } else {
        setError("Failed to add project. Check the path exists.");
      }
    },
    [cwd, name, addProject, onOpenChange],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 pt-[20vh] backdrop-blur-[2px]"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border/70 bg-popover p-6 text-popover-foreground shadow-[0_24px_80px_-36px_rgba(15,23,42,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Add project</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1.5 text-muted-foreground/80 hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-5 text-[13px] text-muted-foreground">
          Register a project directory to launch sessions from.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="project-cwd" className="text-[12px] font-medium">
                Directory path
              </label>
              <input
                ref={inputRef}
                id="project-cwd"
                type="text"
                placeholder="/Users/you/work/project"
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none placeholder:text-muted-foreground/50 focus:border-ring focus:ring-[3px] focus:ring-ring/50"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="project-name" className="text-[12px] font-medium">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="project-name"
                type="text"
                placeholder="Defaults to git repo or folder name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px] outline-none placeholder:text-muted-foreground/50 focus:border-ring focus:ring-[3px] focus:ring-ring/50"
              />
            </div>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-[13px] font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !cwd.trim()}
              className={cn(
                "inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {loading ? "Adding..." : "Add project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
