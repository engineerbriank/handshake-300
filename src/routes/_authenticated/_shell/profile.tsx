import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, UserRound, Settings, LifeBuoy, Info, ScrollText, Shield, Copy, BadgeCheck, LogOut, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, Field, StatusBadge } from "@/components/common/ui-bits";
import { useProfile, displayName } from "@/lib/auth";
import { COUNTRIES } from "@/lib/constants";
import { signOut } from "@/components/app/AppShell";

export const Route = createFileRoute("/_authenticated/_shell/profile")({
  head: () => ({ meta: [{ title: "My Profile — HANDSHAKE" }, { name: "description", content: "Your personal details." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: p } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({ first_name: "", middle_name: "", last_name: "", username: "", phone: "", country: "", headline: "", bio: "" });
  useEffect(() => {
    if (p) setF({ first_name: p.first_name, middle_name: p.middle_name ?? "", last_name: p.last_name, username: p.username ?? "", phone: p.phone ?? "", country: p.country ?? "", headline: p.headline ?? "", bio: p.bio ?? "" });
  }, [p]);
  const save = useMutation({
    mutationFn: async () => {
      if (f.username && !/^[a-z0-9_]{3,30}$/.test(f.username.toLowerCase())) throw new Error("Username: 3–30 lowercase letters, numbers or underscores");
      if (f.phone && !/^\+?[0-9]{9,15}$/.test(f.phone)) throw new Error("Enter a valid phone number with country code");
      const { error } = await supabase.from("profiles").update({
        first_name: f.first_name.trim().slice(0, 60), middle_name: f.middle_name.trim() || null, last_name: f.last_name.trim().slice(0, 60),
        username: f.username.trim().toLowerCase() || null, phone: f.phone.trim() || null, country: f.country || null,
        headline: f.headline.trim().slice(0, 120) || null, bio: f.bio.trim().slice(0, 1500) || null,
      }).eq("id", p!.id);
      if (error) throw new Error(error.message.includes("profiles_username_key") ? "This username is taken" : error.message);
    },
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const verified = p && ["verified", "active"].includes(p.account_status);

  const links = [
    { label: "Skills and Experience", to: "/skills", icon: UserRound },
    { label: "Security Centre", to: "/security", icon: Settings },
    { label: "Client Portal", to: "/employer", icon: Building2 },
    { label: "Support", to: "/report", icon: LifeBuoy },
    { label: "About HANDSHAKE", to: "/how-it-works", icon: Info },
    { label: "Terms & Conditions", to: "/terms", icon: ScrollText },
    { label: "Privacy Policy", to: "/privacy", icon: Shield },
  ] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-xl font-bold">{(p?.first_name?.[0] ?? "") + (p?.last_name?.[0] ?? "")}</span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{displayName(p)}</h1>
          <p className="truncate text-sm text-muted-foreground">{p?.email}</p>
          <div className="mt-1">{verified ? <StatusBadge status="verified" label="Verified Account" /> : <StatusBadge status={p?.account_status} />}</div>
        </div>
      </div>

      <Panel title="Personal details">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Field label="First name"><Input value={f.first_name} onChange={set("first_name")} /></Field>
          <Field label="Last name"><Input value={f.last_name} onChange={set("last_name")} /></Field>
          <Field label="Middle name"><Input value={f.middle_name} onChange={set("middle_name")} /></Field>
          <Field label="Username"><Input value={f.username} onChange={set("username")} /></Field>
          <Field label="Phone" hint="Changing your phone resets phone verification."><Input value={f.phone} onChange={set("phone")} placeholder="+254712345678" /></Field>
          <Field label="Country">
            <Select value={f.country} onValueChange={(v) => setF({ ...f, country: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </Field>
          <div className="sm:col-span-2"><Field label="Professional headline"><Input value={f.headline} onChange={set("headline")} placeholder="e.g. Bilingual customer support specialist" /></Field></div>
          <div className="sm:col-span-2"><Field label="About you"><Textarea rows={4} value={f.bio} onChange={set("bio")} /></Field></div>
          <div className="sm:col-span-2"><Button disabled={save.isPending}>Save changes</Button></div>
        </form>
      </Panel>

      <Panel title="Referral code">
        <div className="flex items-center gap-3">
          <code className="rounded-lg bg-secondary px-3 py-2 font-mono font-bold">{p?.referral_code}</code>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(p?.referral_code ?? ""); toast.success("Copied"); }}><Copy /> Copy</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Share with people you know. Referrals are recorded; HANDSHAKE does not pay referral rewards at this time.</p>
      </Panel>

      <nav className="divide-y rounded-2xl border bg-card shadow-card">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium hover:bg-secondary">
            <l.icon className="h-5 w-5 text-muted-foreground" /> <span className="flex-1">{l.label}</span> <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        <button type="button" onClick={() => signOut(qc, navigate)} className="flex w-full items-center gap-3 px-5 py-3.5 text-sm font-medium text-destructive hover:bg-secondary">
          <LogOut className="h-5 w-5" /> Logout
        </button>
      </nav>
      {verified && <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><BadgeCheck className="h-3.5 w-3.5" /> Accounts are personal and non-transferable.</p>}
    </div>
  );
}
