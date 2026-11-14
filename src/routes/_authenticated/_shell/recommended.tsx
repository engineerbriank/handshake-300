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
import { TaskCard } from "@/components/tasks/TaskCard";
import { useOpenTasks, useTaskProfile } from "@/lib/task-data";
import { recommendTasks } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/_shell/recommended")({
  head: () => ({ meta: [{ title: "Recommended Opportunities — Handshake" }, { name: "description", content: "Paid tasks and remote jobs matched to your skills and country." }, { property: "og:title", content: "Recommended Opportunities — Handshake" }, { property: "og:description", content: "Paid tasks and remote jobs matched to you." }] }),
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
  const openTasks = useOpenTasks();
  const taskProfile = useTaskProfile();
  const tasks = taskProfile.data ? recommendTasks((openTasks.data ?? []).filter((t) => t.slots_claimed < t.slots), taskProfile.data).slice(0, 6) : [];
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
      <PageHeader title="Recommended Opportunities" description="Paid tasks and remote jobs matched to your skills, country and past work." actions={<Button asChild variant="outline"><Link to="/skills">Update skills</Link></Button>} />
      {!skills.data?.length && !skills.isLoading && (
        <p className="mb-4 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">Add skills to your profile for better matches. Showing roles open to {profile?.country ?? "you"} for now.</p>
      )}
      <h2 className="mb-3 text-lg font-bold">Paid tasks</h2>
      {openTasks.isLoading ? <Loading /> : tasks.length ? (
        <div className="mb-6 grid gap-3 md:grid-cols-2">{tasks.map((t) => <TaskCard key={t.id} task={t} />)}</div>
      ) : (
        <p className="mb-6 rounded-xl border bg-card px-4 py-5 text-sm text-muted-foreground">No funded tasks you can take right now. We'll notify you when one matching your skills opens.</p>
      )}
      <h2 className="mb-3 text-lg font-bold">Remote jobs</h2>
      {jobs.isLoading || skills.isLoading ? <Loading /> : jobs.data?.length ? (
        <div className="grid gap-3 md:grid-cols-2">{jobs.data.map((j) => <JobCard key={j.id} job={j} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)} />)}</div>
      ) : (
        <EmptyState icon={<Sparkles />} title="No matches yet" description="Try adding more skills." />
      )}
    </div>
  );
}
