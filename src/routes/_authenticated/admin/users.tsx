import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Search, FileText, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, KeyValue, Loading } from "@/components/common/ui-bits";
import { AdminTabs, AdminTable, Td } from "@/components/admin/AdminBits";
import { tabSearch } from "@/components/admin/admin-nav";
import { dateTime, shortDate, usd, humanize, errorMessage } from "@/lib/format";
import { openPrivate } from "@/lib/upload";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["account_status"];
const STATUSES: Status[] = ["registered", "email_pending", "verification_pending", "verified", "active", "restricted", "suspended", "under_review", "closed"];

export const Route = createFileRoute("/_authenticated/admin/users")({
  validateSearch: tabSearch,
  component: AdminUsers,
});

function AdminUsers() {
  const { tab = "all" } = Route.useSearch();
  const [detail, setDetail] = useState<string | null>(null);
  return (
    <div>
      <PageHeader title="Users" />
      <AdminTabs section="/admin/users" tab={tab} />
      {tab === "all" && <UserList onOpen={setDetail} />}
      {tab === "suspensions" && <UserList onOpen={setDetail} statuses={["suspended", "restricted", "under_review", "closed"]} />}
      {tab === "verification" && <VerificationQueue />}
      {tab === "activity" && <Activity />}
      {tab === "appeals" && <Appeals />}
      {detail && <UserDetail id={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function UserList({ onOpen, statuses }: { onOpen: (id: string) => void; statuses?: Status[] }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const list = useQuery({
    queryKey: ["admin-users", term, statuses],
    queryFn: async () => {
      let qb = supabase.from("profiles").select("id,first_name,last_name,username,email,country,account_status,created_at").order("created_at", { ascending: false }).limit(100);
      if (statuses) qb = qb.in("account_status", statuses);
      if (term) {
        const t = term.replace(/[%,()]/g, " ");
        qb = qb.or(`email.ilike.%${t}%,username.ilike.%${t}%,first_name.ilike.%${t}%,last_name.ilike.%${t}%`);
      }
      const { data, error } = await qb;
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-3">
      <form className="flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or username" />
        <Button><Search /></Button>
      </form>
      {list.isLoading ? <Loading /> : list.error ? <p className="text-sm text-destructive">{errorMessage(list.error)}</p> : (
        <AdminTable head={["Name", "Email", "Country", "Status", "Joined"]} empty={!list.data?.length}>
          {list.data?.map((u) => (
            <tr key={u.id} className="cursor-pointer hover:bg-surface" onClick={() => onOpen(u.id)}>
              <Td className="font-medium">{u.first_name} {u.last_name}<span className="block text-xs text-muted-foreground">@{u.username ?? "—"}</span></Td>
              <Td>{u.email}</Td><Td>{u.country ?? "—"}</Td><Td><StatusBadge status={u.account_status} /></Td><Td>{shortDate(u.created_at)}</Td>
            </tr>
          ))}
        </AdminTable>
      )}
    </div>
  );
}

function UserDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status | "">("");
  const [reason, setReason] = useState("");
  const d = useQuery({
    queryKey: ["admin-user", id],
    queryFn: async () => {
      const [p, v, w, s] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("user_verifications").select("*").eq("user_id", id),
        supabase.from("wallets").select("*").eq("user_id", id).maybeSingle(),
        supabase.from("user_sessions").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(5),
      ]);
      return { p: p.data, v: v.data ?? [], w: w.data, s: s.data ?? [] };
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_set_user_status", { _user: id, _status: status as Status, _reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["admin-user", id] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); setReason(""); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const p = d.data?.p;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{p ? `${p.first_name} ${p.last_name}` : "User"}</DialogTitle></DialogHeader>
        {!p ? <Loading /> : (
          <div className="space-y-4">
            <KeyValue items={[
              { label: "Email", value: p.email }, { label: "Username", value: p.username ?? "—" }, { label: "Phone", value: p.phone ?? "—" },
              { label: "Country", value: p.country ?? "—" }, { label: "Status", value: <StatusBadge status={p.account_status} /> },
              { label: "Status reason", value: p.status_reason ?? "—" }, { label: "Joined", value: dateTime(p.created_at) },
              { label: "Wallet (available / reserved)", value: d.data?.w ? `${usd(d.data.w.available_usd)} / ${usd(d.data.w.reserved_usd)}` : "Finance role required" },
            ]} />
            <div className="flex flex-wrap gap-2">{d.data?.v.map((v) => <span key={v.id} className="flex items-center gap-1 text-xs">{humanize(v.kind)} <StatusBadge status={v.status} /></span>)}</div>
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-semibold">Change account status</p>
              <div className="flex flex-wrap gap-2">
                <Select value={status} onValueChange={(v) => setStatus(v as Status)}><SelectTrigger className="w-48"><SelectValue placeholder="New status" /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}</SelectContent></Select>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to user, audited)" className="min-w-0 flex-1" />
                <Button onClick={() => save.mutate()} disabled={!status || reason.trim().length < 3 || save.isPending}>Apply</Button>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Recent sign-ins</p>
              <ul className="space-y-1 text-xs">{d.data?.s.map((s) => <li key={s.id} className={s.suspicious ? "text-warning" : "text-muted-foreground"}>{dateTime(s.created_at)} · {s.ip_address} · {s.country ?? "—"} {s.suspicious && "· flagged"}</li>)}</ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VerificationQueue() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const ids = useQuery({
    queryKey: ["admin-verif"],
    queryFn: async () => (await supabase.from("user_verifications").select("*, profile:profiles(first_name,last_name,email,country)").eq("kind", "identity").eq("status", "pending").order("submitted_at")).data ?? [],
  });
  const methods = useQuery({
    queryKey: ["admin-methods"],
    queryFn: async () => (await supabase.from("withdrawal_methods").select("*, profile:profiles(first_name,last_name,email)").eq("ownership_status", "pending").order("created_at")).data ?? [],
  });
  const reviewId = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.rpc("admin_review_verification", { _verification: id, _status: status, _notes: notes[id] ?? "" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-verif"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reviewMethod = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.rpc("admin_review_method", { _method: id, _status: status, _notes: notes[id] ?? "" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-methods"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-bold">Identity documents</h2>
        <AdminTable head={["User", "Submitted", "Document", "Notes", "Decision"]} empty={!ids.data?.length}>
          {ids.data?.map((v) => (
            <tr key={v.id}>
              <Td className="font-medium">{v.profile?.first_name} {v.profile?.last_name}<span className="block text-xs text-muted-foreground">{v.profile?.email} · {v.profile?.country}</span></Td>
              <Td>{dateTime(v.submitted_at)}</Td>
              <Td>{v.document_path && <Button size="sm" variant="outline" onClick={() => openPrivate(v.document_path!).catch((e) => toast.error(errorMessage(e)))}><FileText /> View</Button>}</Td>
              <Td><Textarea rows={1} value={notes[v.id] ?? ""} onChange={(e) => setNotes({ ...notes, [v.id]: e.target.value })} placeholder="Reason / note" className="min-w-40" /></Td>
              <Td className="whitespace-nowrap"><Button size="sm" variant="success" onClick={() => reviewId.mutate({ id: v.id, status: "approved" })}>Approve</Button> <Button size="sm" variant="outline" onClick={() => reviewId.mutate({ id: v.id, status: "rejected" })}>Reject</Button></Td>
            </tr>
          ))}
        </AdminTable>
      </section>
      <section>
        <h2 className="mb-2 font-bold">Payment account ownership</h2>
        <AdminTable head={["User", "Method", "Account", "Notes", "Decision"]} empty={!methods.data?.length}>
          {methods.data?.map((m) => (
            <tr key={m.id}>
              <Td className="font-medium">{m.profile?.first_name} {m.profile?.last_name}<span className="block text-xs text-muted-foreground">{m.profile?.email}</span></Td>
              <Td>{m.label}</Td>
              <Td>{m.account_name}<span className="block text-xs text-muted-foreground">{m.phone ?? m.account_number ?? m.email} {m.bank_name}</span>
                {m.account_name.toLowerCase() !== `${m.profile?.first_name} ${m.profile?.last_name}`.toLowerCase() && <span className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" /> Name differs from profile</span>}</Td>
              <Td><Textarea rows={1} value={notes[m.id] ?? ""} onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })} placeholder="Note" className="min-w-40" /></Td>
              <Td className="whitespace-nowrap"><Button size="sm" variant="success" onClick={() => reviewMethod.mutate({ id: m.id, status: "approved" })}>Verify</Button> <Button size="sm" variant="outline" onClick={() => reviewMethod.mutate({ id: m.id, status: "rejected" })}>Reject</Button></Td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}

function Activity() {
  const q = useQuery({ queryKey: ["admin-activity"], queryFn: async () => (await supabase.from("user_sessions").select("*, profile:profiles(email)").order("created_at", { ascending: false }).limit(200)).data ?? [] });
  return (
    <AdminTable head={["When", "User", "IP", "Country", "Device", "Flag"]} empty={!q.data?.length}>
      {q.data?.map((s) => (
        <tr key={s.id} className={s.suspicious ? "bg-warning-soft/50" : ""}><Td>{dateTime(s.created_at)}</Td><Td>{s.profile?.email}</Td><Td>{s.ip_address}</Td><Td>{s.country ?? "—"}</Td><Td className="max-w-xs truncate text-xs text-muted-foreground">{s.user_agent}</Td><Td>{s.suspicious && <StatusBadge status="on_hold" label="Suspicious" />}</Td></tr>
      ))}
    </AdminTable>
  );
}

function Appeals() {
  const q = useQuery({ queryKey: ["admin-appeals"], queryFn: async () => (await supabase.from("support_tickets").select("*, profile:profiles(email,account_status)").eq("category", "appeal").order("created_at", { ascending: false })).data ?? [] });
  return (
    <AdminTable head={["Submitted", "User", "Account", "Appeal", "Status"]} empty={!q.data?.length}>
      {q.data?.map((t) => (
        <tr key={t.id}><Td>{dateTime(t.created_at)}</Td><Td>{t.profile?.email}</Td><Td><StatusBadge status={t.profile?.account_status} /></Td><Td><b>{t.subject}</b><p className="text-xs text-muted-foreground">{t.message}</p></Td><Td><StatusBadge status={t.status} /></Td></tr>
      ))}
    </AdminTable>
  );
}
