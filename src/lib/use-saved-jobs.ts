import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./auth";

export function useSavedJobs() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["saved-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_jobs").select("job_id").eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.job_id));
    },
  });
  const m = useMutation({
    mutationFn: async (jobId: string) => {
      if (!user) throw new Error("signin");
      if (q.data?.has(jobId)) {
        const { error } = await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", jobId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: jobId });
      if (error) throw error;
      return true;
    },
    onSuccess: (saved) => {
      toast.success(saved ? "Job saved" : "Removed from saved jobs");
      qc.invalidateQueries({ queryKey: ["saved-ids"] });
      qc.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
    onError: (e) => {
      if ((e as Error).message === "signin") navigate({ to: "/auth", search: { redirect: window.location.pathname } });
      else toast.error((e as Error).message);
    },
  });
  return { saved: q.data ?? new Set<string>(), toggle: (id: string) => m.mutate(id) };
}
