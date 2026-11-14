import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useProfile } from "./auth";
import type { RecProfile } from "./tasks";

export const TASK_FIELDS = "id,title,description,pay_usd,slots,slots_claimed,deadline,estimated_minutes,category,required_skills,eligible_countries,status,paused,publish_at,difficulty,submission_types,published_at";

export function useOpenTasks() {
  return useQuery({
    queryKey: ["tasks-open"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assignments").select(TASK_FIELDS)
        .eq("status", "published").eq("paused", false).gt("deadline", new Date().toISOString())
        .order("published_at", { ascending: false }).limit(500);
      if (error) throw error;
      const now = Date.now();
      return (data ?? []).filter((t) => !t.publish_at || new Date(t.publish_at).getTime() <= now).map((t) => ({ ...t, pay_usd: Number(t.pay_usd) }));
    },
  });
}

export function useTaskCategories() {
  return useQuery({
    queryKey: ["task-categories"],
    staleTime: 10 * 60_000,
    queryFn: async () => (await supabase.from("task_categories").select("slug,name,kind,sort_order").order("sort_order")).data ?? [],
  });
}

/** Skills, country and past task outcomes used to rank tasks. */
export function useTaskProfile() {
  const { user } = useCurrentUser();
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["task-profile", user?.id, profile?.country],
    enabled: !!user,
    queryFn: async (): Promise<RecProfile> => {
      const [skills, claims] = await Promise.all([
        supabase.from("user_skills").select("skill").eq("user_id", user!.id),
        supabase.from("assignment_claims").select("status, assignment:assignments(category)").eq("user_id", user!.id),
      ]);
      const completed: Record<string, number> = {}; const rejected: Record<string, number> = {};
      for (const c of claims.data ?? []) {
        const cat = (c.assignment as { category: string } | null)?.category; if (!cat) continue;
        if (c.status === "credited") completed[cat] = (completed[cat] ?? 0) + 1;
        if (c.status === "rejected") rejected[cat] = (rejected[cat] ?? 0) + 1;
      }
      return { skills: (skills.data ?? []).map((s) => s.skill), country: profile?.country ?? null, completedCategories: completed, rejectedCategories: rejected };
    },
  });
}
