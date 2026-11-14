import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Loading } from "@/components/common/ui-bits";
import { JobCard } from "@/components/jobs/JobCard";
import { Button } from "@/components/ui/button";
import { listJobs } from "@/lib/jobs.functions";
import { useCurrentUser, useProfile } from "@/lib/auth";
import { useSavedJobs } from "@/lib/use-saved-jobs";

export const Route = createFileRoute("/_authenticated/_shell/recommended")({
  head: () => ({ meta: [{ title: "Recommended Jobs — Handshake" }, { name: "description", content: "Jobs matched to your skills." }] }),
  component: Recommended,
});

function Recommended() {
  const { user } = useCurrentUser();
  const { data: profile } = useProfile();
  const { saved, toggle } = useSavedJobs();
  const skills = useQuery({
    queryKey: ["skills", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("user_skills").select("skill").eq("user_id", user!.id)).data?.map((s) => s.skill.toLowerCase()) ?? [],
  });
  const jobs = useQuery({
    queryKey: ["recommended", skills.data, profile?.country],
    enabled: !!skills.data,
    queryFn: async () => {
      const bySkill = skills.data!.length ? await listJobs({ data: { skills: skills.data!, pageSize: 30, page: 1 } }) : { jobs: [], total: 0 };
      if (bySkill.jobs.length >= 6) return bySkill.jobs;
      const byCountry = await listJobs({ data: { country: profile?.country ?? undefined, pageSize: 20, page: 1 } });
      const seen = new Set(bySkill.jobs.map((j) => j.id));
      return [...bySkill.jobs, ...byCountry.jobs.filter((j) => !seen.has(j.id))];
    },
  });
  return (
    <div>
      <PageHeader title="Recommended Jobs" description="Matched to the skills on your profile and roles open to your country." actions={<Button asChild variant="outline"><Link to="/skills">Update skills</Link></Button>} />
      {!skills.data?.length && !skills.isLoading && (
        <p className="mb-4 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">Add skills to your profile for better matches. Showing roles open to {profile?.country ?? "you"} for now.</p>
      )}
      {jobs.isLoading || skills.isLoading ? <Loading /> : jobs.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">{jobs.data.map((j) => <JobCard key={j.id} job={j} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)} />)}</div>
      ) : (
        <EmptyState icon={<Sparkles />} title="No matches yet" description="Try adding more skills." />
      )}
    </div>
  );
}
