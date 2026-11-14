import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Clock, Users, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, Loading, ErrorNote } from "@/components/common/ui-bits";
import { Badge } from "@/components/ui/badge";
import { usd, shortDate, humanize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/assignments/")({
  head: () => ({ meta: [{ title: "Handshake Assignments" }, { name: "description", content: "Funded digital assignments you can claim." }] }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const q = useQuery({
    queryKey: ["assignments-open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignments")
        .select("id,title,description,pay_usd,slots,slots_claimed,deadline,estimated_minutes,category,required_skills,eligible_countries,status")
        .eq("status", "published")
        .gt("deadline", new Date().toISOString())
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div>
      <PageHeader title="Handshake Assignments" description="Paid digital work funded in advance. Each assignment's full budget is reserved before it is published." />
      {q.isLoading ? <Loading /> : q.error ? <ErrorNote error={q.error} /> : q.data!.length === 0 ? (
        <EmptyState icon={<Briefcase />} title="No open assignments right now" description="New funded assignments are published regularly. You'll get a notification when one is available." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {q.data!.map((a) => {
            const left = a.slots - a.slots_claimed;
            return (
              <Link key={a.id} to="/assignments/$assignmentId" params={{ assignmentId: a.id }} className="rounded-2xl border bg-card p-5 shadow-card hover:border-primary/20">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-semibold leading-snug">{a.title}</h2>
                  <span className="tabular shrink-0 text-lg font-bold text-success">{usd(a.pay_usd)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {left} of {a.slots} slots left</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{a.estimated_minutes} min</span>
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Due {shortDate(a.deadline)}</span>
                  <Badge variant="muted">{humanize(a.category)}</Badge>
                  {left <= 0 && <Badge variant="destructive">Full</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
