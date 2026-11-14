import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Globe2, MapPin, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ago, salaryLabel } from "@/lib/format";
import { JOB_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type JobListItem = {
  id: string;
  title: string;
  employer: string;
  employer_logo: string | null;
  location: string;
  worldwide: boolean;
  is_remote: boolean;
  employment_type: string | null;
  category: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  published_at: string | null;
  is_verified: boolean;
  source: { name: string; slug: string } | null;
};

export function EmployerLogo({ src, name, className }: { src: string | null; name: string; className?: string }) {
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background text-sm font-bold text-muted-foreground", className)}>
      {src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-contain p-1" onError={(e) => ((e.currentTarget.style.display = "none"))} /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function JobCard({ job, saved, onToggleSave }: { job: JobListItem; saved?: boolean; onToggleSave?: () => void }) {
  const salary = salaryLabel(job);
  const cat = JOB_CATEGORIES.find((c) => c.value === job.category)?.label;
  return (
    <article className="group relative rounded-2xl border bg-card p-4 shadow-card transition hover:border-primary/20">
      <div className="flex gap-3">
        <EmployerLogo src={job.employer_logo} name={job.employer} />
        <div className="min-w-0 flex-1">
          <Link to="/jobs/$jobId" params={{ jobId: job.id }} className="line-clamp-2 font-semibold leading-snug after:absolute after:inset-0">
            {job.title}
          </Link>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
            {job.employer}
            {job.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-info" aria-label="Verified" />}
            <span>·</span>
            <MapPin className="h-3 w-3" /> <span className="truncate">{job.location}</span>
          </p>
        </div>
        {onToggleSave && (
          <button type="button" onClick={onToggleSave} className="relative z-10 -mr-1 -mt-1 h-9 w-9 shrink-0 rounded-lg p-2 hover:bg-secondary" aria-label={saved ? "Remove from saved" : "Save job"}>
            {saved ? <BookmarkCheck className="h-5 w-5 text-info" /> : <Bookmark className="h-5 w-5" />}
          </button>
        )}
      </div>
      {salary && <p className="tabular mt-3 font-bold text-success">{salary}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {job.is_remote && <Badge variant="success">Remote</Badge>}
        {job.worldwide && (
          <Badge variant="info" className="gap-1">
            <Globe2 className="h-3 w-3" /> Worldwide
          </Badge>
        )}
        {job.employment_type && <Badge variant="muted">{job.employment_type}</Badge>}
        {cat && <Badge variant="muted">{cat}</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">
          {job.source?.name} · {ago(job.published_at)}
        </span>
      </div>
    </article>
  );
}
