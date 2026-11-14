import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Share2, Globe2, ExternalLink, Bookmark, BookmarkCheck, CheckCircle2, Flag, CalendarClock, BadgeCheck } from "lucide-react";
import { SmartShell } from "@/components/app/PublicShell";
import { EmployerLogo } from "@/components/jobs/JobCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getJob } from "@/lib/jobs.functions";
import { salaryLabel, shortDate, ago, humanize } from "@/lib/format";
import { useSavedJobs } from "@/lib/use-saved-jobs";
import { useCurrentUser } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

const jobQuery = (id: string) => queryOptions({ queryKey: ["job", id], queryFn: () => getJob({ data: { id } }) });

export const Route = createFileRoute("/jobs/$jobId")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.jobId)) throw notFound();
    const job = await context.queryClient.ensureQueryData(jobQuery(params.jobId));
    if (!job) throw notFound();
    return { title: job.title, employer: job.employer, excerpt: job.excerpt };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} at ${loaderData.employer} — Handshake` },
          { name: "description", content: loaderData.excerpt ?? `Remote role at ${loaderData.employer}.` },
          { property: "og:title", content: `${loaderData.title} at ${loaderData.employer}` },
          { property: "og:description", content: loaderData.excerpt ?? `Remote role at ${loaderData.employer}.` },
          { property: "og:type", content: "article" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "Job unavailable — Handshake" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <SmartShell>
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">This listing is no longer available</p>
        <Button asChild className="mt-4"><Link to="/jobs">Browse current jobs</Link></Button>
      </div>
    </SmartShell>
  ),
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const { data: job } = useSuspenseQuery(jobQuery(jobId));
  const { user } = useCurrentUser();
  const { saved, toggle } = useSavedJobs();
  const qc = useQueryClient();
  const [report, setReport] = useState(false);
  const [reason, setReason] = useState("");

  const app = useQuery({
    queryKey: ["application", jobId, user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("job_applications").select("*").eq("job_id", jobId).eq("user_id", user!.id).maybeSingle()).data,
  });

  const track = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("job_applications").insert({ user_id: user!.id, job_id: jobId, status: "applied" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your applications");
      qc.invalidateQueries({ queryKey: ["application", jobId] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sendReport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("job_reports").insert({ job_id: jobId, user_id: user!.id, reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks — our job team will review this listing.");
      setReport(false);
    },
    onError: (e) => toast.error((e as Error).message.includes("duplicate") ? "You've already reported this listing." : (e as Error).message),
  });

  if (!job) return null;
  const salary = salaryLabel(job);
  const src = job.source as { name: string; website: string | null; attribution: string | null } | null;

  const apply = () => {
    window.open(job.apply_url, "_blank", "noopener");
    if (user && !app.data) {
      setTimeout(() => {
        if (confirm("Did you submit an application on the employer's site? Track it in your Applications.")) track.mutate();
      }, 600);
    }
  };

  return (
    <SmartShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Jobs</Link>
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-secondary"
            aria-label="Share"
            onClick={async () => {
              const url = window.location.href;
              if (navigator.share) await navigator.share({ title: job.title, url }).catch(() => {});
              else {
                await navigator.clipboard.writeText(url);
                toast.success("Link copied");
              }
            }}
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-3xl border bg-card p-5 shadow-card sm:p-7">
          <div className="flex items-start gap-4">
            <EmployerLogo src={job.employer_logo} name={job.employer} className="h-14 w-14" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight sm:text-2xl">{job.title}</h1>
              <p className="mt-1 flex items-center gap-1 text-muted-foreground">{job.employer}{job.is_verified && <BadgeCheck className="h-4 w-4 text-info" />}</p>
            </div>
          </div>
          {salary && <p className="tabular mt-4 text-2xl font-bold">{salary}</p>}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {job.is_remote && <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Remote</Badge>}
            {job.worldwide && <Badge variant="info" className="gap-1"><Globe2 className="h-3 w-3" /> Worldwide</Badge>}
            {job.employment_type && <Badge variant="muted">{job.employment_type}</Badge>}
            {job.experience_level && <Badge variant="muted">{job.experience_level}</Badge>}
            <Badge variant="muted">{humanize(job.category)}</Badge>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-surface p-4 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Location</dt><dd className="font-medium">{job.location}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Published</dt><dd className="font-medium">{shortDate(job.published_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Deadline</dt><dd className="font-medium">{job.deadline ? shortDate(job.deadline) : "Not stated"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Last verified</dt><dd className="font-medium">{ago(job.last_verified_at)}</dd></div>
          </dl>

          {job.eligible_countries.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Eligible countries</p>
              <p className="mt-1 text-sm text-muted-foreground">{job.eligible_countries.join(", ")}</p>
            </div>
          )}

          {job.responsibilities && (
            <section className="mt-6">
              <h2 className="font-bold">Responsibilities</h2>
              <div className="prose-job mt-1" dangerouslySetInnerHTML={{ __html: job.responsibilities }} />
            </section>
          )}
          {job.requirements && (
            <section className="mt-6">
              <h2 className="font-bold">Requirements</h2>
              <div className="prose-job mt-1" dangerouslySetInnerHTML={{ __html: job.requirements }} />
            </section>
          )}
          <section className="mt-6">
            <h2 className="font-bold">Job description</h2>
            {/* Description HTML is sanitised with an allowlist when it is imported. */}
            <div className="prose-job mt-1" dangerouslySetInnerHTML={{ __html: job.description }} />
          </section>

          {job.skills.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {job.skills.map((s) => <Badge key={s} variant="outline" className="capitalize">{s}</Badge>)}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
            Source: {src?.website ? <a href={job.source_url ?? src.website} target="_blank" rel="noopener" className="font-semibold text-foreground underline">{src?.attribution ?? src?.name}</a> : src?.name}. You apply on the employer's or source's website. Handshake does not guarantee employment and does not pay for work performed for external employers.
          </div>
        </div>

        <div className="sticky bottom-20 z-10 mt-4 flex gap-2 rounded-2xl border bg-background/95 p-3 shadow-raised backdrop-blur lg:bottom-4">
          <Button variant="outline" size="lg" className="px-4" onClick={() => toggle(job.id)} aria-label={saved.has(job.id) ? "Unsave" : "Save"}>
            {saved.has(job.id) ? <BookmarkCheck className="text-info" /> : <Bookmark />}
          </Button>
          <Button size="lg" className="flex-1" onClick={apply}>Apply for Job <ExternalLink /></Button>
          {user && (
            <Button variant="ghost" size="lg" className="px-4" onClick={() => setReport(true)} aria-label="Report listing"><Flag /></Button>
          )}
        </div>
        {app.data && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarClock className="h-4 w-4" /> Tracked in your applications since {shortDate(app.data.applied_at)}.</p>
        )}
      </div>

      <Dialog open={report} onOpenChange={setReport}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report this listing</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's wrong? (e.g. scam, expired, asks for payment)" maxLength={1000} />
          <DialogFooter>
            <Button onClick={() => sendReport.mutate()} disabled={reason.trim().length < 3 || sendReport.isPending}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SmartShell>
  );
}
