import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { SmartShell } from "@/components/app/PublicShell";
import { JobCard } from "@/components/jobs/JobCard";
import { JobFilters, parseJobSearch, type JobSearch } from "@/components/jobs/JobFilters";
import { EmptyState, ErrorNote, Loading, PageHeader } from "@/components/common/ui-bits";
import { Button } from "@/components/ui/button";
import { listJobs } from "@/lib/jobs.functions";
import { useSavedJobs } from "@/lib/use-saved-jobs";

const PAGE_SIZE = 20;
const jobsQuery = (s: JobSearch) =>
  queryOptions({
    queryKey: ["jobs", s],
    queryFn: () => listJobs({ data: { ...s, page: s.page ?? 1, pageSize: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

export const Route = createFileRoute("/jobs/")({
  validateSearch: parseJobSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(jobsQuery(deps)),
  head: () => ({
    meta: [
      { title: "Explore remote jobs worldwide — Handshake" },
      { name: "description", content: "Search live international remote jobs by country, category, salary and experience. Apply directly on the employer's site." },
      { property: "og:title", content: "Explore remote jobs worldwide — Handshake" },
      { property: "og:description", content: "Live remote opportunities from verified international job sources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/jobs/" });
  const { data, error } = useSuspenseQuery(jobsQuery(search));
  const isLoading = false;
  const { saved, toggle } = useSavedJobs();
  const page = search.page ?? 1;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <SmartShell>
      <PageHeader title="Explore Jobs" />
      <JobFilters value={search} onChange={(v) => navigate({ search: v })} />
      <p className="mt-4 text-xs text-muted-foreground">
        {data ? `${data.total.toLocaleString()} jobs available` : ""}
      </p>
      {error && <ErrorNote error={error} />}
      {data?.error && <ErrorNote error={data.error} />}
      {isLoading ? (
        <Loading label="Loading jobs" />
      ) : data && data.jobs.length === 0 ? (
        <div className="mt-4"><EmptyState icon={<SearchX />} title="No jobs match these filters" description="Try removing a filter or searching a broader term." /></div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {data?.jobs.map((j) => <JobCard key={j.id} job={j} saved={saved.has(j.id)} onToggleSave={() => toggle(j.id)} />)}
        </div>
      )}
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate({ search: { ...search, page: page - 1 > 1 ? page - 1 : undefined } })}><ChevronLeft /> Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => navigate({ search: { ...search, page: page + 1 } })}>Next <ChevronRight /></Button>
        </div>
      )}
    </SmartShell>
  );
}
