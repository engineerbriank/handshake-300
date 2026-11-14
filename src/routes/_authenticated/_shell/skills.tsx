import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Field } from "@/components/common/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/skills")({
  head: () => ({ meta: [{ title: "Skills and Experience — HANDSHAKE" }, { name: "description", content: "Your skills and work history." }] }),
  component: Skills,
});

function Skills() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [skill, setSkill] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [exp, setExp] = useState({ title: "", company: "", start_date: "", end_date: "", description: "" });
  const skills = useQuery({ queryKey: ["skills-full", user?.id], enabled: !!user, queryFn: async () => (await supabase.from("user_skills").select("*").eq("user_id", user!.id).order("created_at")).data ?? [] });
  const exps = useQuery({ queryKey: ["experience", user?.id], enabled: !!user, queryFn: async () => (await supabase.from("user_experience").select("*").eq("user_id", user!.id).order("start_date", { ascending: false })).data ?? [] });
  const inval = () => { qc.invalidateQueries({ queryKey: ["skills-full"] }); qc.invalidateQueries({ queryKey: ["skills"] }); qc.invalidateQueries({ queryKey: ["experience"] }); };
  const addSkill = useMutation({
    mutationFn: async () => {
      const s = skill.trim();
      if (!s || s.length > 60) throw new Error("Enter a skill (max 60 characters)");
      const { error } = await supabase.from("user_skills").insert({ user_id: user!.id, skill: s, level });
      if (error) throw new Error(error.message.includes("duplicate") ? "You already added this skill" : error.message);
    },
    onSuccess: () => { setSkill(""); inval(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delSkill = useMutation({ mutationFn: async (id: string) => { await supabase.from("user_skills").delete().eq("id", id); }, onSuccess: inval });
  const addExp = useMutation({
    mutationFn: async () => {
      if (!exp.title.trim() || !exp.company.trim()) throw new Error("Title and company are required");
      const { error } = await supabase.from("user_experience").insert({ user_id: user!.id, title: exp.title.trim(), company: exp.company.trim(), start_date: exp.start_date || null, end_date: exp.end_date || null, description: exp.description.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { setExp({ title: "", company: "", start_date: "", end_date: "", description: "" }); inval(); toast.success("Experience added"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const delExp = useMutation({ mutationFn: async (id: string) => { await supabase.from("user_experience").delete().eq("id", id); }, onSuccess: inval });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Skills and Experience" description="Used to recommend jobs and assignments that fit you." />
      <Panel title="Skills">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); addSkill.mutate(); }}>
          <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Data annotation, Excel, Swahili" className="min-w-0 flex-1" />
          <Select value={level} onValueChange={setLevel}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{["beginner", "intermediate", "advanced", "expert"].map((l) => <SelectItem key={l} value={l} className="capitalize">{l}</SelectItem>)}</SelectContent></Select>
          <Button disabled={addSkill.isPending}>Add</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {skills.data?.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm">
              {s.skill} <span className="text-xs capitalize text-muted-foreground">· {s.level}</span>
              <button type="button" onClick={() => delSkill.mutate(s.id)} aria-label={`Remove ${s.skill}`}><X className="h-3.5 w-3.5" /></button>
            </span>
          ))}
          {!skills.data?.length && <p className="text-sm text-muted-foreground">No skills yet.</p>}
        </div>
      </Panel>
      <Panel title="Experience">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); addExp.mutate(); }}>
          <Field label="Job title"><Input value={exp.title} onChange={(e) => setExp({ ...exp, title: e.target.value })} /></Field>
          <Field label="Company"><Input value={exp.company} onChange={(e) => setExp({ ...exp, company: e.target.value })} /></Field>
          <Field label="Start date"><Input type="date" value={exp.start_date} onChange={(e) => setExp({ ...exp, start_date: e.target.value })} /></Field>
          <Field label="End date (blank if current)"><Input type="date" value={exp.end_date} onChange={(e) => setExp({ ...exp, end_date: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Description"><Textarea rows={3} value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} maxLength={2000} /></Field></div>
          <div><Button disabled={addExp.isPending}>Add experience</Button></div>
        </form>
        <ul className="mt-5 space-y-3">
          {exps.data?.map((x) => (
            <li key={x.id} className="flex gap-3 rounded-xl border p-3">
              <div className="flex-1">
                <p className="font-semibold">{x.title} · <span className="font-normal">{x.company}</span></p>
                <p className="text-xs text-muted-foreground">{x.start_date ? shortDate(x.start_date) : "—"} – {x.end_date ? shortDate(x.end_date) : "Present"}</p>
                {x.description && <p className="mt-1 text-sm">{x.description}</p>}
              </div>
              <button type="button" onClick={() => delExp.mutate(x.id)} className="self-start rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
