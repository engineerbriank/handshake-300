import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge, Panel, Field } from "@/components/common/ui-bits";
import { AdminTabs, AdminTable, Td, Notice, SourcesTable } from "@/components/admin/AdminBits";
import { tabSearch } from "@/components/admin/admin-nav";
import { useRoles, hasAny, type AppRole } from "@/lib/auth";
import { dateTime, humanize, errorMessage } from "@/lib/format";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/system")({
  validateSearch: tabSearch,
  component: AdminSystem,
});

const GRANTABLE: AppRole[] = ["operations_admin", "job_manager", "assignment_manager", "finance_admin", "support_admin", "compliance_admin"];
const MATRIX: { role: AppRole; can: string }[] = [
  { role: "super_admin", can: "Everything, plus appointing administrators and changing system settings. Granted only on the server to the verified owner account." },
  { role: "operations_admin", can: "Read users, jobs, assignments, sessions and audit logs; manage support; change account status." },
  { role: "job_manager", can: "Create, approve, edit and remove jobs; run job synchronisation; handle reported listings." },
  { role: "assignment_manager", can: "Create assignment drafts, publish funded assignments, review submissions and resolve disputes." },
  { role: "finance_admin", can: "Wallets, ledger, deposits, funding, withdrawals, payout batches, providers, rates, fees and limits. No job management." },
  { role: "support_admin", can: "Read users and sessions; answer and resolve support tickets." },
  { role: "compliance_admin", can: "Review identity and payment-ownership verification, change account status, read audit logs." },
];

function AdminSystem() {
  const { tab = "admins" } = Route.useSearch();
  const { data: roles } = useRoles();
  const isSuper = hasAny(roles, ["super_admin"]) && roles?.includes("super_admin");
  return (
    <div>
      <PageHeader title="Administration" />
      <AdminTabs section="/admin/system" tab={tab} />
      {["admins", "settings", "notifications", "maintenance"].includes(tab) && !isSuper && <Notice tone="warning">Only the Super Admin can change this area.</Notice>}
      {tab === "admins" && isSuper && <Admins />}
      {tab === "roles" && (
        <AdminTable head={["Role", "Permissions"]}>
          {MATRIX.map((m) => <tr key={m.role}><Td className="font-semibold whitespace-nowrap">{humanize(m.role)}</Td><Td>{m.can}</Td></tr>)}
        </AdminTable>
      )}
      {tab === "audit" && <Audit />}
      {tab === "settings" && isSuper && <Settings />}
      {tab === "notifications" && isSuper && <Broadcast />}
      {tab === "security" && <Security />}
      {tab === "api" && <Api />}
      {tab === "maintenance" && isSuper && <Maintenance />}
    </div>
  );
}

function Admins() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("support_admin");
  const staff = useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id,role,created_at,user_id, profile:profiles!user_roles_user_id_fkey(email,first_name,last_name)").not("role", "in", "(user,client)").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const grant = useMutation({
    mutationFn: async () => {
      const { data: p, error } = await supabase.from("profiles").select("id,account_status").eq("email", email.trim().toLowerCase()).maybeSingle();
      if (error) throw error;
      if (!p) throw new Error("No account with that email. The person must register and verify their email first.");
      const r = await supabase.rpc("admin_grant_role", { _user: p.id, _role: role });
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Role granted. They must enable MFA to use it."); setEmail(""); qc.invalidateQueries({ queryKey: ["admin-staff"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const revoke = useMutation({
    mutationFn: async ({ user, role }: { user: string; role: AppRole }) => { const { error } = await supabase.rpc("admin_revoke_role", { _user: user, _role: role }); if (error) throw error; },
    onSuccess: () => { toast.success("Role revoked"); qc.invalidateQueries({ queryKey: ["admin-staff"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-6">
      <Panel title="Appoint an administrator">
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); grant.mutate(); }}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Registered user's email" required />
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}><SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger><SelectContent>{GRANTABLE.map((r) => <SelectItem key={r} value={r}>{humanize(r)}</SelectItem>)}</SelectContent></Select>
          <Button disabled={grant.isPending}>{grant.isPending && <Loader2 className="animate-spin" />} Grant role</Button>
        </form>
      </Panel>
      <AdminTable head={["Administrator", "Role", "Since", ""]} empty={!staff.data?.length}>
        {staff.data?.map((s) => (
          <tr key={s.id}><Td className="font-medium">{s.profile?.first_name} {s.profile?.last_name}<span className="block text-xs text-muted-foreground">{s.profile?.email}</span></Td><Td><StatusBadge status={s.role} /></Td><Td>{dateTime(s.created_at)}</Td>
            <Td>{s.role !== "super_admin" && <Button size="sm" variant="outline" onClick={() => confirm(`Revoke ${humanize(s.role)} from ${s.profile?.email}?`) && revoke.mutate({ user: s.user_id, role: s.role })}>Revoke</Button>}</Td></tr>
        ))}
      </AdminTable>
    </div>
  );
}

function Audit() {
  const [term, setTerm] = useState("");
  const [q, setQ] = useState("");
  const logs = useQuery({
    queryKey: ["admin-audit", term],
    queryFn: async () => {
      let qb = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (term) qb = qb.ilike("action", `%${term.replace(/[%,()]/g, "")}%`);
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3">
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by action, e.g. withdrawal" /><Button><Search /></Button></form>
      {logs.error && <p className="text-sm text-destructive">{errorMessage(logs.error)}</p>}
      <AdminTable head={["When", "Action", "Entity", "Actor", "Details"]} empty={!logs.data?.length}>
        {logs.data?.map((l) => <tr key={l.id} className="align-top"><Td className="whitespace-nowrap">{dateTime(l.created_at)}</Td><Td className="font-medium">{l.action}</Td><Td className="text-xs">{l.entity_type}<span className="block text-muted-foreground">{l.entity_id}</span></Td><Td className="text-xs">{l.actor_id ?? "system"}</Td><Td><pre className="max-w-sm overflow-x-auto text-[11px] text-muted-foreground">{JSON.stringify(l.details)}</pre></Td></tr>)}
      </AdminTable>
    </div>
  );
}

function useSettings() {
  return useQuery({ queryKey: ["admin-settings"], queryFn: async () => (await supabase.from("system_settings").select("*").order("key")).data ?? [] });
}
function useSaveSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Json }) => { const { error } = await supabase.rpc("admin_update_setting", { _key: key, _value: value }); if (error) throw error; },
    onSuccess: () => { toast.success("Setting saved"); qc.invalidateQueries({ queryKey: ["admin-settings"] }); qc.invalidateQueries({ queryKey: ["public-settings"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function Settings() {
  const s = useSettings();
  const save = useSaveSetting();
  const [draft, setDraft] = useState<Record<string, string>>({});
  return (
    <AdminTable head={["Setting", "Value", ""]} empty={!s.data?.length}>
      {s.data?.map((x) => {
        const isBool = typeof x.value === "boolean";
        const v = draft[x.key] ?? (typeof x.value === "string" ? x.value : JSON.stringify(x.value));
        return (
          <tr key={x.key}>
            <Td><b>{humanize(x.key)}</b><span className="block text-xs text-muted-foreground">{x.description}</span></Td>
            <Td>{isBool ? <Switch checked={x.value === true} onCheckedChange={(c) => save.mutate({ key: x.key, value: c })} /> : <Input className="h-8 min-w-48" value={v} onChange={(e) => setDraft({ ...draft, [x.key]: e.target.value })} />}</Td>
            <Td>{!isBool && <Button size="sm" variant="outline" onClick={() => save.mutate({ key: x.key, value: typeof x.value === "number" ? Number(v) : v })}>Save</Button>}</Td>
          </tr>
        );
      })}
    </AdminTable>
  );
}

function Broadcast() {
  const [f, setF] = useState({ title: "", body: "", link: "" });
  const m = useMutation({
    mutationFn: async () => { const { error } = await supabase.rpc("admin_broadcast", { _title: f.title.trim(), _body: f.body.trim(), _link: f.link.trim() }); if (error) throw error; },
    onSuccess: () => { toast.success("Notification sent to all active users"); setF({ title: "", body: "", link: "" }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Panel title="Send an in-app announcement">
      <form className="grid max-w-2xl gap-4" onSubmit={(e) => { e.preventDefault(); if (confirm("Send this to every user?")) m.mutate(); }}>
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} required /></Field>
        <Field label="Message"><Textarea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={1000} required /></Field>
        <Field label="Link inside the app (optional)"><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="/assignments" /></Field>
        <div><Button disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Send announcement</Button></div>
      </form>
    </Panel>
  );
}

function Security() {
  const flagged = useQuery({ queryKey: ["admin-flagged"], queryFn: async () => (await supabase.from("user_sessions").select("*, profile:profiles(email)").eq("suspicious", true).order("created_at", { ascending: false }).limit(100)).data ?? [] });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {["Administrator access requires a staff role and a multi-factor session, checked inside every database function.", "Balances, ledger entries and audit logs are immutable from the app; only backend functions post balanced transactions.", "Private documents are stored in a locked bucket and opened with short-lived links."].map((t) => (
          <div key={t} className="flex gap-3 rounded-2xl border bg-card p-4 text-sm shadow-card"><ShieldCheck className="h-5 w-5 shrink-0 text-success" />{t}</div>
        ))}
      </div>
      <Panel title="Suspicious sign-ins (new country or device)" bodyClassName="p-0">
        <AdminTable head={["When", "User", "IP", "Country", "Device"]} empty={!flagged.data?.length}>
          {flagged.data?.map((s) => <tr key={s.id}><Td>{dateTime(s.created_at)}</Td><Td>{s.profile?.email}</Td><Td>{s.ip_address}</Td><Td>{s.country ?? "—"}</Td><Td className="max-w-xs truncate text-xs text-muted-foreground">{s.user_agent}</Td></tr>)}
        </AdminTable>
      </Panel>
    </div>
  );
}

function Api() {
  const sources = useQuery({ queryKey: ["admin-sources"], queryFn: async () => (await supabase.from("job_sources").select("*").order("name")).data ?? [] });
  const providers = useQuery({ queryKey: ["admin-providers"], queryFn: async () => (await supabase.from("payment_providers").select("*").order("name")).data ?? [] });
  return (
    <div className="space-y-6">
      <Notice>API keys are stored as encrypted server secrets and are never shown here or sent to browsers. To add or rotate a key, ask in chat with the secret name below.</Notice>
      <Panel title="Job sources" bodyClassName="p-0"><SourcesTable rows={sources.data ?? []} /></Panel>
      <Panel title="Payment providers" bodyClassName="p-0">
        <AdminTable head={["Provider", "Status", "Secrets needed", "Detail"]} empty={!providers.data?.length}>
          {providers.data?.map((p) => <tr key={p.id}><Td className="font-medium">{p.name}</Td><Td><StatusBadge status={p.connection_status} /></Td><Td className="text-xs">{p.required_secrets.join(", ")}</Td><Td className="max-w-sm text-xs text-muted-foreground">{p.last_error ?? p.notes}</Td></tr>)}
        </AdminTable>
      </Panel>
    </div>
  );
}

function Maintenance() {
  const s = useSettings();
  const save = useSaveSetting();
  const mode = s.data?.find((x) => x.key === "maintenance_mode")?.value === true;
  const msg = s.data?.find((x) => x.key === "maintenance_message")?.value;
  const [text, setText] = useState<string | null>(null);
  return (
    <Panel title="Maintenance mode">
      <div className="max-w-xl space-y-4">
        <label className="flex items-center gap-3 text-sm"><Switch checked={mode} onCheckedChange={(c) => confirm(c ? "Show the maintenance notice to all users?" : "Turn off maintenance mode?") && save.mutate({ key: "maintenance_mode", value: c })} /> {mode ? <b className="text-warning">Maintenance notice is showing</b> : "Off"}</label>
        <Field label="Message shown to users"><Textarea rows={3} value={text ?? (typeof msg === "string" ? msg : "")} onChange={(e) => setText(e.target.value)} /></Field>
        <Button variant="outline" disabled={text === null} onClick={() => save.mutate({ key: "maintenance_message", value: text ?? "" })}>Save message</Button>
      </div>
    </Panel>
  );
}
