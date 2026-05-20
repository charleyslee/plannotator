import { useState } from "react";
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
import { GitTab, ReviewDisplayTab, CommentsTab } from "@plannotator/ui/components/Settings";
import { ThemeTab } from "@plannotator/ui/components/ThemeTab";
import { KeyboardShortcuts } from "@plannotator/ui/components/KeyboardShortcuts";
import { AISettingsTab } from "@plannotator/ui/components/AISettingsTab";
import { HooksTab } from "@plannotator/ui/components/settings/HooksTab";

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

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {label} settings — extraction in progress.
    </div>
  );
}

export function AppSettingsDialog() {
  const open = useAppStore((s) => s.settingsOpen);
  const setOpen = useAppStore((s) => s.setSettingsOpen);
  const [activeTab, setActiveTab] = useState("general");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <Tabs
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
              <PlanGeneralTab />
            </TabsContent>
            <TabsContent value="plan-display">
              <PlanDisplayTab />
            </TabsContent>
            <TabsContent value="plan-saving">
              <SavingTab onNavigateTab={setActiveTab} />
            </TabsContent>
            <TabsContent value="plan-labels">
              <PlaceholderTab label="Quick annotation labels" />
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
              <AISettingsTab />
            </TabsContent>

            {/* Integrations */}
            <TabsContent value="int-files">
              <PlaceholderTab label="File browser directories" />
            </TabsContent>
            <TabsContent value="int-obsidian">
              <PlaceholderTab label="Obsidian vault sync" />
            </TabsContent>
            <TabsContent value="int-bear">
              <PlaceholderTab label="Bear Notes" />
            </TabsContent>
            <TabsContent value="int-octarine">
              <PlaceholderTab label="Octarine workspace" />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
