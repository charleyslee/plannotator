import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { daemonApiClient } from "../../daemon/api/client";
import { useProjectStore } from "../../stores/project-store";
import type { ProjectEntry } from "../../daemon/contracts";

export function useProjectActions() {
  const navigate = useNavigate();
  const removeProject = useProjectStore((s) => s.removeProject);

  const startCodeReview = useCallback(
    async (project: ProjectEntry) => {
      const result = await daemonApiClient.createReviewSession(project.cwd);
      if (result.ok) {
        void navigate({ to: "/s/$sessionId", params: { sessionId: result.data.session.id } });
      } else {
        toast.error("Failed to start code review", { description: result.error.message });
      }
    },
    [navigate],
  );

  const startArchive = useCallback(
    async (project: ProjectEntry) => {
      const result = await daemonApiClient.createArchiveSession(project.cwd);
      if (result.ok) {
        void navigate({ to: "/s/$sessionId", params: { sessionId: result.data.session.id } });
      } else {
        toast.error("Failed to open archive", { description: result.error.message });
      }
    },
    [navigate],
  );

  const remove = useCallback(
    async (project: ProjectEntry) => {
      const ok = await removeProject(project.name);
      if (!ok) {
        toast.error("Failed to remove project", { description: project.name });
      }
    },
    [removeProject],
  );

  return { startCodeReview, startArchive, removeProject: remove };
}
