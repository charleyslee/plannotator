import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../components/landing/LandingPage";
import { useAppStore } from "../stores/app-store";
import { appStore } from "../stores/app-store";

export const Route = createFileRoute("/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  const setAddProjectOpen = useAppStore((s) => s.setAddProjectOpen);

  useEffect(() => {
    appStore.getState().deactivateSession();
  }, []);

  return <LandingPage onAddProject={() => setAddProjectOpen(true)} />;
}
