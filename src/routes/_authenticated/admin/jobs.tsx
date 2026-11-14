import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, Field, Panel } from "@/components/common/ui-bits";
import { AdminTabs, AdminTable, Td, Notice } from "@/components/admin/AdminBits";
import { tabSearch } from "@/components/admin/admin-nav";
import { adminCreateJob, adminRunJobSync } from "@/lib/admin.functions";
import { JOB_CATEGORIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "@/lib/constants";
import { ago, dateTime, shortDate, errorMessage } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type JobStatus = Database["public"]["Enums"]["job_status"];

export const Route = createFileRoute("/_authenticated/admin/jobs")({
  validateSearch: tabSearch,
  component: AdminJobs,
});

function AdminJobs() {
  const { tab = "all" } = Route.useSearch();
  return (
    <div>
      <PageHeader title="Jobs" />
      <AdminTabs section="/admin/jobs" tab={tab} />
      {tab === "all" && <JobList statuses={["active"]} />}
      {tab === "approve" && <JobList statuses={["pending_review"]} approve />}
      {tab === "expired" && <JobList statuses={["expired", "removed", "rejected"]} />}
      {tab === "create" && <CreateJob />}
      {tab === "sources" && <Sources />}
      {tab === "reported" && <Reported />}
    </div>
  );
}

function useJobUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Database["public"]["Tables"]["jobs"]["Update"] }) => {
      const { error } = await supabase.from("jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-jobs"] }); qc.invalidateQueries({ queryKey: ["admin-reports"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function JobList({ statuses, approve }: { statuses: JobStatus[]; approve?: boolean }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const upd = useJobUpdate();
  const list = useQuery({
    queryKey: ["admin-jobs", statuses, term],
    queryFn: async () => {
      let qb = supabase.from("jobs").select("id,title,employer,category,status,is_verified,published_at,last_verified_at,apply_url,report_count,source:job_sources(name)").in("status", statuses).order("published_at", { ascending: false, nullsFirst: false }).limit(100);
      if (term) qb = qb.or(`title.ilike.%${term.replace(/[%,()]/g, " ")}%,employer.ilike.%${term.replace(/[%,()]/g, " ")}%`);
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3">
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or employer" /><Button><Search /></Button></form>
      <AdminTable head={["Job", "Source", "Category", "Status", "Verified", "Published", "Actions"]} empty={!list.data?.length}>
        {list.data?.map((j) => (
          <tr key={j.id}>
            <Td className="max-w-xs"><Link to="/jobs/$jobId" params={{ jobId: j.id }} className="font-medium hover:underline">{j.title}</Link><span className="block text-xs text-muted-foreground">{j.employer}</span></Td>
            <Td>{j.source?.name}</Td>
            <Td>
              <Select value={j.category} onValueChange={(v) => upd.mutate({ id: j.id, patch: { category: v } })}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{JOB_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </Td>
            <Td><StatusBadge status={j.status} /></Td>
            <Td><Switch checked={j.is_verified} onCheckedChange={(v) => upd.mutate({ id: j.id, patch: { is_verified: v } })} /></Td>
            <Td className="whitespace-nowrap">{shortDate(j.published_at)}<span className="block text-xs text-muted-foreground">checked {ago(j.last_verified_at)}</span></Td>
            <Td className="whitespace-nowrap">
              <a href={j.apply_url} target="_blank" rel="noopener" className="mr-1 inline-flex rounded-lg p-1.5 hover:bg-secondary" aria-label="Open original"><ExternalLink className="h-4 w-4" /></a>
              {approve ? (
                <><Button size="sm" variant="success" onClick={() => upd.mutate({ id: j.id, patch: { status: "active" } })}>Approve</Button> <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: j.id, patch: { status: "rejected" } })}>Reject</Button></>
              ) : j.status === "active" ? (
                <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: j.id, patch: { status: "removed" } })}>Remove</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: j.id, patch: { status: "active", last_verified_at: new Date().toISOString() } })}>Re-activate</Button>
              )}
            </Td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}

function CreateJob() {
  const [f, setF] = useState({ title: "", employer: "", description: "", responsibilities: "", requirements: "", location: "Remote — Worldwide", countries: "", worldwide: true, employment_type: "Full-time", category: "technology", experience_level: "Mid", salary_min: "", salary_max: "", salary_period: "annual", skills: "", deadline: "", apply_url: "", publish: false, verified: false });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () =>
      adminCreateJob({
        data: {
          title: f.title, employer: f.employer, description: f.description, responsibilities: f.responsibilities || undefined, requirements: f.requirements || undefined,
          location: f.location, eligible_countries: f.countries.split(",").map((s) => s.trim()).filter(Boolean), worldwide: f.worldwide,
          employment_type: f.employment_type, category: f.category, experience_level: f.experience_level,
          salary_min: f.salary_min ? Number(f.salary_min) : undefined, salary_max: f.salary_max ? Number(f.salary_max) : undefined, salary_currency: "USD",
          salary_period: f.salary_period as "annual", skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean), deadline: f.deadline || undefined,
          apply_url: f.apply_url, status: f.publish ? "active" : "pending_review", is_verified: f.verified,
        },
      }),
    onSuccess: () => { toast.success("Job saved"); setF({ ...f, title: "", description: "", responsibilities: "", requirements: "", apply_url: "" }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Panel title="Create a direct employer job">
      <Notice>Only post roles from a real employer who has confirmed the opening. The application link must go to the employer's own application page or inbox.</Notice>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Field label="Title"><Input value={f.title} onChange={set("title")} required /></Field>
        <Field label="Employer"><Input value={f.employer} onChange={set("employer")} required /></Field>
        <div className="md:col-span-2"><Field label="Description"><Textarea rows={6} value={f.description} onChange={set("description")} required /></Field></div>
        <Field label="Responsibilities (one per line)"><Textarea rows={4} value={f.responsibilities} onChange={set("responsibilities")} /></Field>
        <Field label="Requirements (one per line)"><Textarea rows={4} value={f.requirements} onChange={set("requirements")} /></Field>
        <Field label="Location"><Input value={f.location} onChange={set("location")} /></Field>
        <Field label="Eligible countries (comma separated, blank = worldwide)"><Input value={f.countries} onChange={set("countries")} /></Field>
        <Field label="Employment type"><Select value={f.employment_type} onValueChange={(v) => setF({ ...f, employment_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Category"><Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{JOB_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Experience"><Select value={f.experience_level} onValueChange={(v) => setF({ ...f, experience_level: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPERIENCE_LEVELS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Skills (comma separated)"><Input value={f.skills} onChange={set("skills")} /></Field>
        <Field label="Salary min (USD, optional)"><Input type="number" value={f.salary_min} onChange={set("salary_min")} /></Field>
        <Field label="Salary max (USD, optional)"><Input type="number" value={f.salary_max} onChange={set("salary_max")} /></Field>
        <Field label="Salary period"><Select value={f.salary_period} onValueChange={(v) => setF({ ...f, salary_period: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="annual">Per year</SelectItem><SelectItem value="monthly">Per month</SelectItem><SelectItem value="hourly">Per hour</SelectItem></SelectContent></Select></Field>
        <Field label="Application deadline"><Input type="date" value={f.deadline} onChange={set("deadline")} /></Field>
        <div className="md:col-span-2"><Field label="Application URL"><Input type="url" value={f.apply_url} onChange={set("apply_url")} placeholder="https://employer.example/careers/role" required /></Field></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.worldwide} onCheckedChange={(v) => setF({ ...f, worldwide: v })} /> Open worldwide</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.verified} onCheckedChange={(v) => setF({ ...f, verified: v })} /> Employer verified</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.publish} onCheckedChange={(v) => setF({ ...f, publish: v })} /> Publish now (otherwise goes to approval)</label>
        <div className="md:col-span-2"><Button disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Save job</Button></div>
      </form>
    </Panel>
  );
}

function Sources() {
  const qc = useQueryClient();
  const sources = useQuery({ queryKey: ["admin-sources"], queryFn: async () => (await supabase.from("job_sources").select("*").order("name")).data ?? [] });
  const logs = useQuery({ queryKey: ["admin-sync-logs"], queryFn: async () => (await supabase.from("job_sync_logs").select("*, source:job_sources(name)").order("started_at", { ascending: false }).limit(30)).data ?? [] });
  const sync = useMutation({
    mutationFn: (source?: string) => adminRunJobSync({ data: { source } }),
    onSuccess: (r) => { toast.success(r.map((x) => `${x.source}: ${x.status} (${x.upserted})`).join(" · ")); qc.invalidateQueries({ queryKey: ["admin-sources"] }); qc.invalidateQueries({ queryKey: ["admin-sync-logs"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => { const { error } = await supabase.from("job_sources").update({ enabled }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sources"] }),
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Sources synchronise automatically every 6 hours. Listings not seen for 3 days or past their deadline are expired.</p>
        <Button onClick={() => sync.mutate(undefined)} disabled={sync.isPending}>{sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync all now</Button>
      </div>
      <AdminTable head={["Source", "Enabled", "Status", "Active", "Last sync", "Credentials", "Detail", ""]} empty={!sources.data?.length}>
        {sources.data?.map((s) => (
          <tr key={s.id}>
            <Td className="font-medium">{s.name}<span className="block text-xs text-muted-foreground">{s.attribution}</span></Td>
            <Td><Switch checked={s.enabled} onCheckedChange={(v) => toggle.mutate({ id: s.id, enabled: v })} /></Td>
            <Td><StatusBadge status={s.last_status} /></Td>
            <Td className="tabular">{s.active_jobs}</Td>
            <Td>{s.last_sync_at ? ago(s.last_sync_at) : "Never"}</Td>
            <Td className="text-xs">{s.requires_credentials ? s.credential_names.join(", ") : "None needed"}</Td>
            <Td className="max-w-xs text-xs text-muted-foreground">{s.last_error ?? "—"}</Td>
            <Td>{s.slug !== "direct" && <Button size="sm" variant="outline" onClick={() => sync.mutate(s.slug)} disabled={sync.isPending}>Sync</Button>}</Td>
          </tr>
        ))}
      </AdminTable>
      <Notice tone="warning">Adzuna and Jooble need API keys from their partner programmes. Once you have them, ask in chat to add ADZUNA_APP_ID, ADZUNA_APP_KEY and JOOBLE_API_KEY as secure secrets — they are never stored in the app code.</Notice>
      <Panel title="Recent synchronisation runs" bodyClassName="p-0">
        <AdminTable head={["Started", "Source", "Status", "Fetched", "Saved", "Duplicates", "Invalid", "Expired", "Error"]} empty={!logs.data?.length}>
          {logs.data?.map((l) => (
            <tr key={l.id}><Td>{dateTime(l.started_at)}</Td><Td>{l.source?.name}</Td><Td><StatusBadge status={l.status} /></Td><Td>{l.fetched}</Td><Td>{l.upserted}</Td><Td>{l.duplicates}</Td><Td>{l.invalid}</Td><Td>{l.expired}</Td><Td className="max-w-xs text-xs text-destructive">{l.error}</Td></tr>
          ))}
        </AdminTable>
      </Panel>
    </div>
  );
}

function Reported() {
  const qc = useQueryClient();
  const upd = useJobUpdate();
  const q = useQuery({ queryKey: ["admin-reports"], queryFn: async () => (await supabase.from("job_reports").select("*, job:jobs(id,title,employer,status), profile:profiles(email)").eq("status", "open").order("created_at", { ascending: false })).data ?? [] });
  const close = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "actioned" | "dismissed" }) => { const { error } = await supabase.from("job_reports").update({ status }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });
  return (
    <AdminTable head={["Reported", "Job", "By", "Reason", "Actions"]} empty={!q.data?.length}>
      {q.data?.map((r) => (
        <tr key={r.id}>
          <Td>{dateTime(r.created_at)}</Td>
          <Td>{r.job && <Link to="/jobs/$jobId" params={{ jobId: r.job.id }} className="font-medium hover:underline">{r.job.title}</Link>}<span className="block text-xs text-muted-foreground">{r.job?.employer} · {r.job?.status}</span></Td>
          <Td>{r.profile?.email}</Td>
          <Td className="max-w-sm">{r.reason}</Td>
          <Td className="whitespace-nowrap">
            <Button size="sm" variant="destructive" onClick={() => { if (r.job) upd.mutate({ id: r.job.id, patch: { status: "removed" } }); close.mutate({ id: r.id, status: "actioned" }); }}>Remove job</Button>{" "}
            <Button size="sm" variant="outline" onClick={() => close.mutate({ id: r.id, status: "dismissed" })}>Dismiss</Button>
          </Td>
        </tr>
      ))}
    </AdminTable>
  );
}
