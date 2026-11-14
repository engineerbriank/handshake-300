import {
  LayoutDashboard, Search, Briefcase, Sparkles, Bookmark, FileText, ClipboardList, Wallet, LineChart, ArrowUpRight,
  CreditCard, Receipt, User, FileUser, Award, FolderOpen, ShieldCheck, Bell, Lock, History, LifeBuoy, Flag, ScrollText, Shield,
} from "lucide-react";

export type NavItem = { label: string; to: string; icon: typeof Search };
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Main",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Explore Jobs", to: "/jobs", icon: Search },
      { label: "HANDSHAKE Assignments", to: "/assignments", icon: Briefcase },
      { label: "Recommended Jobs", to: "/recommended", icon: Sparkles },
      { label: "Saved Jobs", to: "/saved", icon: Bookmark },
      { label: "Applications", to: "/applications", icon: FileText },
      { label: "My Work", to: "/work", icon: ClipboardList },
    ],
  },
  {
    title: "Earnings",
    items: [
      { label: "USD Wallet", to: "/wallet", icon: Wallet },
      { label: "Earnings History", to: "/earnings", icon: LineChart },
      { label: "Withdrawals", to: "/withdrawals", icon: ArrowUpRight },
      { label: "Payment Methods", to: "/payment-methods", icon: CreditCard },
      { label: "Transactions", to: "/transactions", icon: Receipt },
    ],
  },
  {
    title: "Profile",
    items: [
      { label: "My Profile", to: "/profile", icon: User },
      { label: "My CV", to: "/cv", icon: FileUser },
      { label: "Skills and Experience", to: "/skills", icon: Award },
      { label: "Portfolio", to: "/portfolio", icon: FolderOpen },
      { label: "Verification Centre", to: "/verification", icon: ShieldCheck },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Notifications", to: "/notifications", icon: Bell },
      { label: "Security Centre", to: "/security", icon: Lock },
      { label: "Login Activity", to: "/login-activity", icon: History },
      { label: "Help Centre", to: "/help", icon: LifeBuoy },
      { label: "Report a Problem", to: "/report", icon: Flag },
      { label: "Terms", to: "/terms", icon: ScrollText },
      { label: "Privacy Policy", to: "/privacy", icon: Shield },
    ],
  },
];
