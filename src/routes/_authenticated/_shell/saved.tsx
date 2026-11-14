import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Loading } from "@/components/common/ui-bits";
import { JobCard, type JobListItem } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth";
import { useSavedJobs } from "@/lib/use-saved-jobs";

export const Route = createFileRoute("/_authenticated/_shell/saved")({
  head: () => ({ meta: [{ title: "Saved Jobs — Handshake" }, { name: "description", content: "Jobs you've saved." }] }),
  component: Saved,
});

function Saved() {
  const { user } = useCurrentUser();
  const { saved, toggle } = useSavedJobs();
  const q = useQuery({
    queryKey: ["saved-jobs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_jobs")
        .select("created_at, job:jobs(id,title,employer,employer_logo,location,worldwide,is_remote,employment_type,category,salary_min,salary_max,salary_currency,salary_period,published_at,is_verified,status,source:job_sources(name,slug))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.job).filter(Boolean) as unknown as (JobListItem & { status: string })[];
    },
  });
  return (
    <div>
      <PageHeader title="Saved Jobs" />
      {q.isLoading ? <Loading /> : q.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data.map((j) => (
            <div key={j.id} className={j.status !== "active" ? "opacity-60" : ""}>
              <JobCard job={j} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)} />
              {j.status !== "active" && <p className="mt-1 text-xs text-muted-foreground">This listing has expired.</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Bookmark />} title="No saved jobs" description="Tap the bookmark on any job to save it here." action={<Button asChild><Link to="/jobs">Explore jobs</Link></Button>} />
      )}
    </div>
  );
}
