import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, UserRound, ScanFace, Wallet, CheckCircle2, Circle, Clock, XCircle, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/common/ui-bits";
import { useVerifications } from "@/lib/user-data";
import { useCurrentUser, useProfile } from "@/lib/auth";
import { uploadPrivate, validateFile } from "@/lib/upload";
import { humanize, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_shell/verification")({
  head: () => ({ meta: [{ title: "Verification Centre — Handshake" }, { name: "description", content: "Complete your account verification." }] }),
  component: Verification,
});

const STEPS = [
  { kind: "email", title: "Email address", desc: "Confirm the link we emailed you.", icon: Mail, required: "Required to sign in" },
  { kind: "profile", title: "Profile completion", desc: "Name, username, phone number and country.", icon: UserRound, required: "Required to claim assignments" },
  { kind: "identity", title: "Identity", desc: "Upload a government-issued ID (passport, national ID or driving licence).", icon: ScanFace, required: "Required to withdraw" },
  { kind: "payment_ownership", title: "Payment account ownership", desc: "Add your payout account; our team confirms it is in your name.", icon: Wallet, required: "Required to withdraw" },
] as const;

function StatusIcon({ s }: { s: string }) {
  if (s === "approved") return <CheckCircle2 className="h-6 w-6 text-success" />;
  if (s === "pending") return <Clock className="h-6 w-6 text-warning" />;
  if (s === "rejected") return <XCircle className="h-6 w-6 text-destructive" />;
  return <Circle className="h-6 w-6 text-muted-foreground/50" />;
}

function Verification() {
  const { data: v } = useVerifications();
  const { data: profile } = useProfile();
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const byKind = (k: string) => v?.find((x) => x.kind === k);

  const resend = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.resend({ type: "signup", email: user!.email!, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Confirmation email sent"),
    onError: (e) => toast.error((e as Error).message),
  });
  const uploadId = useMutation({
    mutationFn: async (file: File) => {
      const err = validateFile(file, ["image", "document"]);
      if (err) throw new Error(err);
      const path = await uploadPrivate(user!.id, "identity", file);
      await supabase.from("user_documents").insert({ user_id: user!.id, category: "identity", title: "Identity document", file_path: path, mime_type: file.type, size_bytes: file.size });
      const { error } = await supabase.rpc("submit_identity_verification", { _document_path: path });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document submitted for review"); qc.invalidateQueries({ queryKey: ["verifications"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const done = STEPS.filter((s) => byKind(s.kind)?.status === "approved").length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Verification Centre" description="Verification protects your earnings and keeps Handshake free of fraud." />
      <div className="mb-6 rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div><p className="text-sm text-muted-foreground">Account status</p><div className="mt-1"><StatusBadge status={profile?.account_status} /></div></div>
          <p className="tabular text-2xl font-bold">{done}/{STEPS.length}</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
        {profile?.status_reason && !["verified", "active", "email_pending", "verification_pending"].includes(profile.account_status) && <p className="mt-3 text-sm text-destructive">{profile.status_reason}</p>}
      </div>
      <ol className="space-y-3">
        {STEPS.map((s) => {
          const row = byKind(s.kind);
          const status = row?.status ?? "not_started";
          return (
            <li key={s.kind} className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="flex gap-4">
                <StatusIcon s={status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold"><s.icon className="h-4 w-4 text-muted-foreground" />{s.title}</p>
                    <StatusBadge status={status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.required}{row?.reviewed_at && ` · Updated ${dateTime(row.reviewed_at)}`}</p>
                  {row?.notes && <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs">Reviewer note: {row.notes}</p>}
                  <div className="mt-3">
                    {s.kind === "email" && status !== "approved" && <Button size="sm" variant="outline" onClick={() => resend.mutate()} disabled={resend.isPending}>Resend email</Button>}
                    {s.kind === "profile" && status !== "approved" && <Button size="sm" asChild><Link to="/profile">Complete profile</Link></Button>}
                    {s.kind === "identity" && (status === "not_started" || status === "rejected") && (
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                        {uploadId.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload ID document
                        <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadId.mutate(e.target.files[0])} />
                      </label>
                    )}
                    {s.kind === "identity" && status === "pending" && <p className="text-sm text-warning">Under review by our compliance team.</p>}
                    {s.kind === "payment_ownership" && status !== "approved" && <Button size="sm" variant="outline" asChild><Link to="/payment-methods">{status === "pending" ? "View payment methods" : "Add payment method"}</Link></Button>}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-center text-xs text-muted-foreground">Status: {humanize(profile?.account_status)}. Accounts are personal and non-transferable.</p>
    </div>
  );
}
