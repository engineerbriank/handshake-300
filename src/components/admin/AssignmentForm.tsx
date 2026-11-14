import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/ui-bits";
import { JOB_CATEGORIES } from "@/lib/constants";
import { useCurrentUser } from "@/lib/auth";
import { usd, errorMessage } from "@/lib/format";

/** Creates an assignment draft. Funding and publishing happen separately through audited backend functions. */
export function AssignmentForm({ employerId, onCreated }: { employerId?: string; onCreated?: () => void }) {
  const { user } = useCurrentUser();
  const empty = { title: "", description: "", instructions: "", deliverables: "", review_requirements: "", revision_policy: "", eligibility: "", skills: "", category: "data_entry", pay_usd: "", slots: "", deadline: "", estimated_minutes: "", max_revisions: "1", countries: "" };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const total = Number(f.pay_usd || 0) * Number(f.slots || 0);
  const m = useMutation({
    mutationFn: async () => {
      const pay = Math.round(Number(f.pay_usd) * 100) / 100;
      if (!(pay > 0)) throw new Error("Enter a payment amount");
      if (!(Number(f.slots) >= 1)) throw new Error("Enter at least one slot");
      if (!f.deadline || new Date(f.deadline) <= new Date()) throw new Error("Deadline must be in the future");
      const { error } = await supabase.from("assignments").insert({
        employer_id: employerId ?? null, created_by: user!.id, title: f.title.trim(), description: f.description.trim(), instructions: f.instructions.trim(),
        deliverables: f.deliverables.trim(), review_requirements: f.review_requirements.trim() || null, revision_policy: f.revision_policy.trim() || null,
        eligibility: f.eligibility.trim() || null, required_skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean), category: f.category,
        pay_usd: pay, slots: Math.floor(Number(f.slots)), deadline: new Date(f.deadline).toISOString(), estimated_minutes: Math.max(1, Math.floor(Number(f.estimated_minutes) || 30)),
        max_revisions: Math.min(10, Math.max(0, Number(f.max_revisions) || 0)), eligible_countries: f.countries.split(",").map((s) => s.trim()).filter(Boolean), status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Draft created. It must be funded before publishing."); setF(empty); onCreated?.(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <div className="md:col-span-2"><Field label="Title"><Input value={f.title} onChange={set("title")} minLength={5} required /></Field></div>
      <div className="md:col-span-2"><Field label="Detailed description"><Textarea rows={4} value={f.description} onChange={set("description")} minLength={20} required /></Field></div>
      <div className="md:col-span-2"><Field label="Instructions"><Textarea rows={5} value={f.instructions} onChange={set("instructions")} minLength={10} required /></Field></div>
      <div className="md:col-span-2"><Field label="Required deliverables"><Textarea rows={3} value={f.deliverables} onChange={set("deliverables")} required /></Field></div>
      <Field label="Review requirements"><Textarea rows={2} value={f.review_requirements} onChange={set("review_requirements")} /></Field>
      <Field label="Revision policy"><Textarea rows={2} value={f.revision_policy} onChange={set("revision_policy")} /></Field>
      <Field label="Eligibility notes"><Textarea rows={2} value={f.eligibility} onChange={set("eligibility")} /></Field>
      <Field label="Eligible countries (comma separated, blank = all)"><Input value={f.countries} onChange={set("countries")} /></Field>
      <Field label="Required skills (comma separated)"><Input value={f.skills} onChange={set("skills")} /></Field>
      <Field label="Category"><Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{JOB_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Payment per approved submission (USD)"><Input type="number" min="0.01" step="0.01" value={f.pay_usd} onChange={set("pay_usd")} required /></Field>
      <Field label="Available slots"><Input type="number" min="1" value={f.slots} onChange={set("slots")} required /></Field>
      <Field label="Deadline"><Input type="datetime-local" value={f.deadline} onChange={set("deadline")} required /></Field>
      <Field label="Estimated duration (minutes)"><Input type="number" min="1" value={f.estimated_minutes} onChange={set("estimated_minutes")} /></Field>
      <Field label="Revisions allowed"><Input type="number" min="0" max="10" value={f.max_revisions} onChange={set("max_revisions")} /></Field>
      <div className="flex items-end"><p className="text-sm">Budget to reserve: <b className="tabular">{usd(total)}</b></p></div>
      <div className="md:col-span-2"><Button disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />} Create draft</Button></div>
    </form>
  );
}
