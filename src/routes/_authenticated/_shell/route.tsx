import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { MaintenanceBanner } from "@/components/app/MaintenanceBanner";

export const Route = createFileRoute("/_authenticated/_shell")({
  component: () => (
    <AppShell>
      <MaintenanceBanner />
      <Outlet />
    </AppShell>
  ),
});
