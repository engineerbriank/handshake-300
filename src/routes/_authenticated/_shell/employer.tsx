import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, FileDown, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Field, StatusBadge, Loading, EmptyState } from "@/components/common/ui-bits";
import { AdminTable, Td, Notice } from "@/components/admin/AdminBits";
import { AssignmentForm } from "@/components/admin/AssignmentForm";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { useCurrentUser } from "@/lib/auth";
import { COUNTRIES } from "@/lib/constants";
import { usd, dateTime, shortDate, errorMessage } from "@/lib/format";
import { uploadPrivate, validateFile } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/_shell/employer")({
  head: () => ({ meta: [{ title: "Client Portal — HANDSHAKE" }, { name: "description", content: "Create, fund and review paid digital assignments on HANDSHAKE." }] }),
  component: EmployerPortal,
});

function EmployerPortal() {
  const { user } = useCurrentUser();
  const emp = useQuery({
    queryKey: ["employer", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("employer_profiles").select("*").eq("owner_id", user!.id).maybeSingle()).data,
  });
  if (emp.isLoading) return <Loading />;
  if (!emp.data) return <CreateEmployer />;
  return <Portal employer={emp.data} />;
}

function CreateEmployer() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [f, setF] = useState({ company_name: "", website: "", country: "", billing_email: user?.email ?? "", description: "" });
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employer_profiles").insert({ owner_id: user!.id, company_name: f.company_name.trim(), website: f.website.trim() || null, country: f.country || null, billing_email: f.billing_email.trim(), description: f.description.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Client account created"); qc.invalidateQueries({ queryKey: ["employer"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Client Portal" description="Publish funded digital assignments for HANDSHAKE workers." />
      <Panel title="Create your client account">
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="md:col-span-2"><Field label="Company or organisation name"><Input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} required minLength={2} /></Field></div>
          <Field label="Website"><Input type="url" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></Field>
          <Field label="Country"><Select value={f.country} onValueChange={(v) => setF({ ...f, country: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
          <div className="md:col-span-2"><Field label="Billing email"><Input type="email" value={f.billing_email} onChange={(e) => setF({ ...f, billing_email: e.target.value })} required /></Field></div>
          <div className="md:col-span-2"><Field label="About your organisation"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
          <div className="md:col-span-2"><Button disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Create client account</Button></div>
        </form>
      </Panel>
    </div>
  );
}

type Employer = NonNullable<Awaited<ReturnType<typeof fetchEmployer>>>;
async function fetchEmployer() { return (await supabase.from("employer_profiles").select("*").limit(1).maybeSingle()).data; }

function Portal({ employer }: { employer: Employer }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"assignments" | "create" | "reviews" | "invoices" | "company">("assignments");
  const list = useQuery({
    queryKey: ["employer-assignments", employer.id],
    queryFn: async () => (await supabase.from("assignments").select("*, budget:assignment_budgets(total_usd,released_usd,refunded_usd,funded_at)").eq("employer_id", employer.id).order("created_at", { ascending: false })).data ?? [],
  });
  const ids = (list.data ?? []).map((a) => a.id);
  return (
    <div>
      <PageHeader title={employer.company_name} description="Client Portal" actions={<StatusBadge status={employer.verified ? "verified" : "pending"} label={employer.verified ? "Verified client" : "Verification pending"} />} />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b">
        {([["assignments", "Assignments"], ["create", "New assignment"], ["reviews", "Review submissions"], ["invoices", "Invoices"], ["company", "Company & verification"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      {tab === "assignments" && (
        <div className="space-y-4">
          <Notice>Assignments are published only after the full budget (pay × slots) is received and reserved. To fund a draft, request payment instructions below; HANDSHAKE finance records your payment against its reference and reserves the budget.</Notice>
          {!list.data?.length ? <EmptyState icon={<Building2 className="h-6 w-6" />} title="No assignments yet" description="Create your first draft to get started." action={<Button onClick={() => setTab("create")}>New assignment</Button>} /> : (
            <AdminTable head={["Assignment", "Budget", "Claimed", "Deadline", "Status", ""]}>
              {list.data.map((a) => (
                <tr key={a.id}>
                  <Td className="max-w-xs font-medium">{a.status === "published" ? <Link to="/assignments/$assignmentId" params={{ assignmentId: a.id }} className="hover:underline">{a.title}</Link> : a.title}</Td>
                  <Td className="tabular">{usd(Number(a.pay_usd) * a.slots)}<span className="block text-xs text-muted-foreground">{usd(a.pay_usd)} × {a.slots}</span></Td>
                  <Td>{a.slots_claimed}/{a.slots}</Td>
                  <Td>{dateTime(a.deadline)}</Td>
                  <Td><StatusBadge status={a.status} /></Td>
                  <Td>{a.status === "draft" && <FundingRequest assignment={a} employer={employer} />}</Td>
                </tr>
              ))}
            </AdminTable>
          )}
        </div>
      )}
      {tab === "create" && <Panel title="New assignment draft"><AssignmentForm employerId={employer.id} onCreated={() => { qc.invalidateQueries({ queryKey: ["employer-assignments"] }); setTab("assignments"); }} /></Panel>}
      {tab === "reviews" && (ids.length ? <ReviewQueue statuses={["submitted", "under_review", "disputed"]} assignmentIds={ids} /> : <EmptyState title="Nothing to review" />)}
      {tab === "invoices" && <Invoices employer={employer} rows={(list.data ?? []).filter((a) => a.budget)} />}
      {tab === "company" && <Company employer={employer} />}
    </div>
  );
}

function FundingRequest({ assignment, employer }: { assignment: { id: string; title: string; pay_usd: number; slots: number }; employer: Employer }) {
  const { user } = useCurrentUser();
  const [sent, setSent] = useState(false);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user!.id, category: "funding", priority: "normal", status: "open",
        subject: `Funding request: ${assignment.title}`.slice(0, 200),
        message: `Client: ${employer.company_name} (${employer.billing_email})\nAssignment ID: ${assignment.id}\nAmount to reserve: ${usd(Number(assignment.pay_usd) * assignment.slots)}\nPlease send payment instructions and an invoice reference.`,
      });
      if (error) throw error;
    },
    onSuccess: () => { setSent(true); toast.success("Funding request sent. Finance will reply with payment instructions."); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return <Button size="sm" variant="outline" disabled={sent || m.isPending} onClick={() => m.mutate()}>{sent ? "Requested" : "Request funding"}</Button>;
}

function Invoices({ employer, rows }: { employer: Employer; rows: { id: string; title: string; budget: { total_usd: number; released_usd: number; refunded_usd: number; funded_at: string } | null }[] }) {
  const download = (r: (typeof rows)[number]) => {
    const b = r.budget!;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${r.id.slice(0, 8).toUpperCase()}</title><style>body{font:14px system-ui,sans-serif;max-width:720px;margin:40px auto;color:#0b1b33}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border-bottom:1px solid #dde3ec;padding:8px;text-align:left}.r{text-align:right}</style></head><body>
<h1>HANDSHAKE — Assignment funding statement</h1><p>Reference: HS-${r.id.slice(0, 8).toUpperCase()}<br>Date funded: ${shortDate(b.funded_at)}</p>
<p><b>Billed to:</b> ${escapeHtml(employer.company_name)}<br>${escapeHtml(employer.billing_email)}${employer.country ? "<br>" + escapeHtml(employer.country) : ""}</p>
<table><tr><th>Description</th><th class="r">USD</th></tr><tr><td>Budget reserved: ${escapeHtml(r.title)}</td><td class="r">${Number(b.total_usd).toFixed(2)}</td></tr>
<tr><td>Paid to workers for approved submissions</td><td class="r">${Number(b.released_usd).toFixed(2)}</td></tr><tr><td>Returned (unused budget)</td><td class="r">${Number(b.refunded_usd).toFixed(2)}</td></tr>
<tr><th>Remaining in escrow</th><th class="r">${(Number(b.total_usd) - Number(b.released_usd) - Number(b.refunded_usd)).toFixed(2)}</th></tr></table>
<p style="margin-top:32px;color:#5b6b82;font-size:12px">Generated from the HANDSHAKE ledger. Use your browser's Print → Save as PDF to keep a copy.</p></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url; a.download = `handshake-invoice-${r.id.slice(0, 8)}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!rows.length) return <EmptyState title="No invoices yet" description="A statement is available for each funded assignment." />;
  return (
    <AdminTable head={["Assignment", "Funded", "Reserved", "Paid out", "Returned", ""]}>
      {rows.map((r) => (
        <tr key={r.id}><Td className="font-medium">{r.title}</Td><Td>{shortDate(r.budget!.funded_at)}</Td><Td className="tabular">{usd(r.budget!.total_usd)}</Td><Td className="tabular">{usd(r.budget!.released_usd)}</Td><Td className="tabular">{usd(r.budget!.refunded_usd)}</Td>
          <Td><Button size="sm" variant="outline" onClick={() => download(r)}><FileDown /> Download</Button></Td></tr>
      ))}
    </AdminTable>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function Company({ employer }: { employer: Employer }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [f, setF] = useState({ company_name: employer.company_name, website: employer.website ?? "", billing_email: employer.billing_email, description: employer.description ?? "" });
  const verifs = useQuery({ queryKey: ["employer-verifs", employer.id], queryFn: async () => (await supabase.from("employer_verifications").select("*").eq("employer_id", employer.id).order("created_at", { ascending: false })).data ?? [] });
  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("employer_profiles").update({ company_name: f.company_name.trim(), website: f.website.trim() || null, billing_email: f.billing_email.trim(), description: f.description.trim() || null }).eq("id", employer.id); if (error) throw error; },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["employer"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const err = validateFile(file, ["document", "image"]);
      if (err) throw new Error(err);
      const path = await uploadPrivate(user!.id, "employer", file);
      const { error } = await supabase.from("employer_verifications").insert({ employer_id: employer.id, document_path: path, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document submitted for review"); qc.invalidateQueries({ queryKey: ["employer-verifs"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Company details">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="Name"><Input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} required /></Field>
          <Field label="Website"><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></Field>
          <Field label="Billing email"><Input type="email" value={f.billing_email} onChange={(e) => setF({ ...f, billing_email: e.target.value })} required /></Field>
          <Field label="About"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Button disabled={save.isPending}>Save</Button>
        </form>
      </Panel>
      <Panel title="Business verification">
        <p className="text-sm text-muted-foreground">Upload a company registration certificate or equivalent (PDF or image, up to 10 MB). Compliance reviews it before your account shows as verified.</p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-secondary">
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload document
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.target.value = ""; }} />
        </label>
        <ul className="mt-4 space-y-2 text-sm">{verifs.data?.map((v) => <li key={v.id} className="flex items-center justify-between"><span>{dateTime(v.created_at)}</span><StatusBadge status={v.status} /></li>)}</ul>
      </Panel>
    </div>
  );
}
