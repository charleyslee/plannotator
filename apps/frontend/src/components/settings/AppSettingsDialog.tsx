import { useState, useEffect, useCallback } from "react";
import { Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAppStore } from "../../stores/app-store";
import { GeneralTab } from "@plannotator/ui/components/settings/GeneralTab";
import { PlanGeneralTab } from "@plannotator/ui/components/settings/PlanGeneralTab";
import { PlanDisplayTab } from "@plannotator/ui/components/settings/PlanDisplayTab";
import { SavingTab } from "@plannotator/ui/components/settings/SavingTab";
import { LabelsTab } from "@plannotator/ui/components/settings/LabelsTab";
import { FilesTab } from "@plannotator/ui/components/settings/FilesTab";
import { ObsidianTab } from "@plannotator/ui/components/settings/ObsidianTab";
import { BearTab } from "@plannotator/ui/components/settings/BearTab";
import { OctarineTab } from "@plannotator/ui/components/settings/OctarineTab";
import { GitTab, ReviewDisplayTab, CommentsTab } from "@plannotator/ui/components/Settings";
import { ThemeTab } from "@plannotator/ui/components/ThemeTab";
import { KeyboardShortcuts } from "@plannotator/ui/components/KeyboardShortcuts";
import { AISettingsTab } from "@plannotator/ui/components/AISettingsTab";
import { HooksTab } from "@plannotator/ui/components/settings/HooksTab";
import { getAIProviderSettings, saveAIProviderSettings } from "@plannotator/ui/utils/aiProvider";

interface TabDef {
  id: string;
  label: string;
}

const GENERAL_TABS: TabDef[] = [
  { id: "general", label: "General" },
  { id: "theme", label: "Theme" },
  { id: "shortcuts", label: "Shortcuts" },
];

const PLAN_TABS: TabDef[] = [
  { id: "plan-general", label: "General" },
  { id: "plan-display", label: "Display" },
  { id: "plan-saving", label: "Saving" },
  { id: "plan-labels", label: "Labels" },
  { id: "plan-hooks", label: "Hooks" },
];

const REVIEW_TABS: TabDef[] = [
  { id: "review-git", label: "Git" },
  { id: "review-display", label: "Display" },
  { id: "review-comments", label: "Comments" },
  { id: "review-ai", label: "AI" },
];

const INTEGRATION_TABS: TabDef[] = [
  { id: "int-files", label: "Files" },
  { id: "int-obsidian", label: "Obsidian" },
  { id: "int-bear", label: "Bear" },
  { id: "int-octarine", label: "Octarine" },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

export function AppSettingsDialog() {
  const open = useAppStore((s) => s.settingsOpen);
  const setOpen = useAppStore((s) => s.setSettingsOpen);
  const [activeTab, setActiveTab] = useState("general");

  // Force re-mount of tab content when dialog opens to ensure fresh state
  const [mountKey, setMountKey] = useState(0);
  useEffect(() => {
    if (open) setMountKey((k) => k + 1);
  }, [open]);

  // Detect origin from the active session (if any)
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const visitedSessions = useAppStore((s) => s.visitedSessions);
  const activeOrigin = activeSessionId
    ? (visitedSessions[activeSessionId]?.bootstrap.session.origin as string | undefined) ?? null
    : null;

  // AI provider state — fetched once when dialog opens
  const [aiProviders, setAiProviders] = useState<Array<{ id: string; name: string; capabilities: Record<string, boolean> }>>([]);
  const [aiProviderId, setAiProviderId] = useState<string | null>(() => getAIProviderSettings().providerId);

  // Re-read AI provider on each open (could have changed via per-surface settings)
  useEffect(() => {
    if (open) setAiProviderId(getAIProviderSettings().providerId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/ai/capabilities")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.providers) setAiProviders(data.providers);
      })
      .catch(() => {});
  }, [open]);

  const handleAiProviderChange = useCallback((providerId: string | null) => {
    setAiProviderId(providerId);
    const current = getAIProviderSettings();
    saveAIProviderSettings({ ...current, providerId });
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <Tabs
          key={mountKey}
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="vertical"
          className="flex h-[min(600px,80vh)]"
        >
          <div className="w-44 shrink-0 border-r border-border overflow-y-auto py-2 px-2">
            <div className="flex items-center gap-2 px-3 pb-3 pt-1">
              <Settings className="size-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Settings</span>
            </div>

            <TabsList className="flex-col gap-0.5">
              <SectionLabel>General</SectionLabel>
              {GENERAL_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="w-full justify-start h-8">
                  {tab.label}
                </TabsTrigger>
              ))}

              <SectionLabel>Plan Review</SectionLabel>
              {PLAN_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="w-full justify-start h-8">
                  {tab.label}
                </TabsTrigger>
              ))}

              <SectionLabel>Code Review</SectionLabel>
              {REVIEW_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="w-full justify-start h-8">
                  {tab.label}
                </TabsTrigger>
              ))}

              <SectionLabel>Integrations</SectionLabel>
              {INTEGRATION_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="w-full justify-start h-8">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* General */}
            <TabsContent value="general">
              <GeneralTab />
            </TabsContent>
            <TabsContent value="theme">
              <ThemeTab />
            </TabsContent>
            <TabsContent value="shortcuts">
              <KeyboardShortcuts mode="plan" />
            </TabsContent>

            {/* Plan Review */}
            <TabsContent value="plan-general">
              <PlanGeneralTab origin={activeOrigin} />
            </TabsContent>
            <TabsContent value="plan-display">
              <PlanDisplayTab />
            </TabsContent>
            <TabsContent value="plan-saving">
              <SavingTab onNavigateTab={setActiveTab} />
            </TabsContent>
            <TabsContent value="plan-labels">
              <LabelsTab />
            </TabsContent>
            <TabsContent value="plan-hooks">
              <HooksTab />
            </TabsContent>

            {/* Code Review */}
            <TabsContent value="review-git">
              <GitTab />
            </TabsContent>
            <TabsContent value="review-display">
              <ReviewDisplayTab />
            </TabsContent>
            <TabsContent value="review-comments">
              <CommentsTab />
            </TabsContent>
            <TabsContent value="review-ai">
              <AISettingsTab
                providers={aiProviders}
                selectedProviderId={aiProviderId}
                onProviderChange={handleAiProviderChange}
              />
            </TabsContent>

            {/* Integrations */}
            <TabsContent value="int-files">
              <FilesTab />
            </TabsContent>
            <TabsContent value="int-obsidian">
              <ObsidianTab />
            </TabsContent>
            <TabsContent value="int-bear">
              <BearTab />
            </TabsContent>
            <TabsContent value="int-octarine">
              <OctarineTab />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
