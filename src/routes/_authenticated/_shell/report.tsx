import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Field, StatusBadge } from "@/components/common/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { dateTime, humanize } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/report")({
  head: () => ({ meta: [{ title: "Report a Problem — HANDSHAKE" }, { name: "description", content: "Contact HANDSHAKE support." }] }),
  component: Report,
});

const CATS = ["general", "account", "verification", "jobs", "assignments", "wallet", "withdrawal", "security", "report", "appeal"] as const;

function Report() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [f, setF] = useState({ subject: "", category: "general", message: "" });
  const tickets = useQuery({ queryKey: ["tickets", user?.id], enabled: !!user, queryFn: async () => (await supabase.from("support_tickets").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [] });
  const create = useMutation({
    mutationFn: async () => {
      if (f.subject.trim().length < 3 || f.message.trim().length < 10) throw new Error("Please add a subject and at least 10 characters of detail.");
      const { error } = await supabase.from("support_tickets").insert({ user_id: user!.id, subject: f.subject.trim(), category: f.category, message: f.message.trim(), priority: f.category === "security" ? "high" : "normal" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ticket submitted"); setF({ subject: "", category: "general", message: "" }); qc.invalidateQueries({ queryKey: ["tickets"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Report a Problem" description="Report bugs, suspicious listings, account issues or appeal a decision." />
      <Panel>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Field label="Category">
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="Subject"><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={150} /></Field>
          <Field label="Details"><Textarea rows={6} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={5000} /></Field>
          <Button disabled={create.isPending}>Submit</Button>
        </form>
      </Panel>
      <Panel title="Your tickets" bodyClassName="p-0">
        {tickets.data?.length ? (
          <ul className="divide-y">
            {tickets.data.map((t) => (
              <li key={t.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="font-semibold">{t.subject}</span><StatusBadge status={t.status} /></div>
                <p className="text-xs text-muted-foreground">{humanize(t.category)} · {dateTime(t.created_at)}</p>
                {t.staff_response && <p className="mt-2 rounded-lg bg-surface px-3 py-2">Support: {t.staff_response}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-6 text-sm text-muted-foreground">No tickets yet.</p>}
      </Panel>
    </div>
  );
}
