import {
  Code2,
  FileText,
  ListChecks,
  ScrollText,
  Target,
  Archive,
  type LucideIcon,
} from "lucide-react";
import type { SessionMode } from "../daemon/contracts";

export interface SessionModeMeta {
  icon: LucideIcon;
  label: string;
}

const MODE_META: Record<string, SessionModeMeta> = {
  plan: { icon: ScrollText, label: "Plan" },
  review: { icon: Code2, label: "Review" },
  annotate: { icon: FileText, label: "Annotate" },
  archive: { icon: Archive, label: "Archive" },
  "goal-setup": { icon: Target, label: "Goal Setup" },
};

const FALLBACK: SessionModeMeta = { icon: ListChecks, label: "Session" };

export function getSessionModeMeta(mode: SessionMode): SessionModeMeta {
  return MODE_META[mode] ?? FALLBACK;
}
