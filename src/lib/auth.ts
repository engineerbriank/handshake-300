import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
    staleTime: 60_000,
  });
}

export function useCurrentUser() {
  const { data: session, ...rest } = useSession();
  return { user: session?.user ?? null, ...rest };
}

export function useProfile() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRoles() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role) as AppRole[];
    },
  });
}

export const STAFF: AppRole[] = [
  "super_admin",
  "operations_admin",
  "job_manager",
  "assignment_manager",
  "finance_admin",
  "support_admin",
  "compliance_admin",
];

export function isStaff(roles: AppRole[] | undefined) {
  return !!roles?.some((r) => STAFF.includes(r));
}

export function hasAny(roles: AppRole[] | undefined, wanted: AppRole[]) {
  if (!roles) return false;
  if (roles.includes("super_admin")) return true;
  return roles.some((r) => wanted.includes(r));
}

export function displayName(p: Pick<Profile, "first_name" | "last_name"> | null | undefined) {
  if (!p) return "";
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}
