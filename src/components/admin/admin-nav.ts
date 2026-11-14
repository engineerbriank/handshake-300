import { LayoutDashboard, Users, Briefcase, ClipboardCheck, Landmark, LifeBuoy, Settings2 } from "lucide-react";
import type { AppRole } from "@/lib/auth";

export type AdminSection = {
  title: string;
  to: "/admin" | "/admin/users" | "/admin/jobs" | "/admin/assignments" | "/admin/finance" | "/admin/support" | "/admin/system";
  icon: typeof Users;
  roles: AppRole[];
  tabs: { tab: string; label: string }[];
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { title: "Overview", to: "/admin", icon: LayoutDashboard, roles: [], tabs: [{ tab: "dashboard", label: "Dashboard" }, { tab: "analytics", label: "Analytics" }, { tab: "health", label: "System Health" }] },
  { title: "Users", to: "/admin/users", icon: Users, roles: ["operations_admin", "compliance_admin", "support_admin"], tabs: [{ tab: "all", label: "All Users" }, { tab: "verification", label: "Verification" }, { tab: "activity", label: "Activity" }, { tab: "suspensions", label: "Suspensions" }, { tab: "appeals", label: "Appeals" }] },
  { title: "Jobs", to: "/admin/jobs", icon: Briefcase, roles: ["job_manager", "operations_admin"], tabs: [{ tab: "all", label: "All Jobs" }, { tab: "create", label: "Create Job" }, { tab: "approve", label: "Approve Jobs" }, { tab: "sources", label: "Job Sources & APIs" }, { tab: "expired", label: "Expired Jobs" }, { tab: "reported", label: "Reported Listings" }] },
  { title: "Assignments", to: "/admin/assignments", icon: ClipboardCheck, roles: ["assignment_manager", "finance_admin"], tabs: [{ tab: "all", label: "All Assignments" }, { tab: "create", label: "Create Assignment" }, { tab: "budgets", label: "Budgets" }, { tab: "reviews", label: "Submissions & Reviews" }, { tab: "disputes", label: "Disputes" }] },
  { title: "Finance", to: "/admin/finance", icon: Landmark, roles: ["finance_admin"], tabs: [{ tab: "wallets", label: "Wallets" }, { tab: "ledger", label: "Ledger" }, { tab: "withdrawals", label: "Withdrawals" }, { tab: "batches", label: "Payout Batches" }, { tab: "providers", label: "Payment Providers" }, { tab: "rates", label: "Exchange Rates" }, { tab: "reconciliation", label: "Reconciliation" }, { tab: "revenue", label: "Platform Revenue" }, { tab: "deposits", label: "Deposits" }, { tab: "fees", label: "Fees & Limits" }] },
  { title: "Support", to: "/admin/support", icon: LifeBuoy, roles: ["support_admin", "operations_admin"], tabs: [{ tab: "open", label: "Open Tickets" }, { tab: "all", label: "All Tickets" }] },
  { title: "Administration", to: "/admin/system", icon: Settings2, roles: ["compliance_admin", "operations_admin"], tabs: [{ tab: "admins", label: "Administrators" }, { tab: "roles", label: "Roles & Permissions" }, { tab: "audit", label: "Audit Logs" }, { tab: "settings", label: "System Settings" }, { tab: "notifications", label: "Notifications" }, { tab: "security", label: "Security" }, { tab: "api", label: "API Configuration" }, { tab: "maintenance", label: "Maintenance Mode" }] },
];

export const tabSearch = (s: Record<string, unknown>): { tab?: string } => ({ tab: typeof s.tab === "string" ? s.tab.slice(0, 30) : undefined });
