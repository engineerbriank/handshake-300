import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Smartphone, Landmark, Mail, Trash2, Star, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, EmptyState, Field } from "@/components/common/ui-bits";
import { useWithdrawalMethods } from "@/lib/user-data";
import { useCurrentUser, useProfile } from "@/lib/auth";
import { COUNTRIES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/_shell/payment-methods")({
  head: () => ({ meta: [{ title: "Payment Methods — HANDSHAKE" }, { name: "description", content: "Manage your payout accounts." }] }),
  component: PaymentMethods,
});

const ICON = { mpesa: Smartphone, bank: Landmark, paypal: Mail } as const;

function PaymentMethods() {
  const { data: methods } = useWithdrawalMethods();
  const providers = useQuery({ queryKey: ["providers"], queryFn: async () => (await supabase.from("payment_providers").select("slug,name,enabled,connection_status,currency")).data ?? [] });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("withdrawal_methods").delete().eq("id", id);
      if (error) throw new Error(error.message.includes("foreign key") ? "This method has withdrawals on record and can't be removed." : error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["methods"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const makeDefault = useMutation({
    mutationFn: async (id: string) => {
      for (const m of methods ?? []) if (m.is_default && m.id !== id) await supabase.from("withdrawal_methods").update({ is_default: false }).eq("id", m.id);
      const { error } = await supabase.from("withdrawal_methods").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["methods"] }),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Payment Methods" description="Payout accounts must be in your own name. Our compliance team verifies ownership before your first withdrawal." actions={<Button onClick={() => setOpen(true)}><Plus /> Add method</Button>} />
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        {providers.data?.map((p) => (
          <div key={p.slug} className="rounded-xl border bg-card p-3 text-xs">
            <p className="font-semibold">{p.name}</p>
            <p className="mt-1 text-muted-foreground">{p.currency} · {!p.enabled ? "Not available yet" : p.connection_status === "live" ? "Live" : "Accepting requests · provider connection pending"}</p>
          </div>
        ))}
      </div>
      {methods?.length ? (
        <div className="space-y-2">
          {methods.map((m) => {
            const Icon = ICON[m.provider as keyof typeof ICON] ?? Landmark;
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
                <Icon className="h-5 w-5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.label} {m.is_default && <span className="text-xs font-normal text-muted-foreground">· Default</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.account_name} · {m.phone ?? m.account_number ?? m.email} {m.bank_name && `· ${m.bank_name}`}</p>
                  {m.review_notes && <p className="text-xs text-muted-foreground">Note: {m.review_notes}</p>}
                </div>
                <StatusBadge status={m.ownership_status} label={m.ownership_status === "approved" ? "Verified" : m.ownership_status === "pending" ? "Verifying" : undefined} />
                {!m.is_default && <button type="button" onClick={() => makeDefault.mutate(m.id)} className="rounded-lg p-2 hover:bg-secondary" aria-label="Make default"><Star className="h-4 w-4" /></button>}
                <button type="button" onClick={() => del.mutate(m.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No payment methods" description="Add M-Pesa to receive KES payouts in Kenya." />
      )}
      {open && <AddMethod onClose={() => setOpen(false)} hasDefault={!!methods?.some((m) => m.is_default)} />}
    </div>
  );
}

const schemas = {
  mpesa: z.object({ account_name: z.string().trim().min(2).max(120), phone: z.string().trim().regex(/^(\+?254|0)?[17][0-9]{8}$/, "Enter a Safaricom number, e.g. +254712345678") }),
  bank: z.object({ account_name: z.string().trim().min(2).max(120), bank_name: z.string().trim().min(2).max(120), account_number: z.string().trim().regex(/^[A-Za-z0-9 -]{6,34}$/, "Enter a valid account number or IBAN"), bank_code: z.string().trim().max(20).optional() }),
  paypal: z.object({ account_name: z.string().trim().min(2).max(120), email: z.string().trim().email() }),
};

function AddMethod({ onClose, hasDefault }: { onClose: () => void; hasDefault: boolean }) {
  const { user } = useCurrentUser();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [provider, setProvider] = useState<"mpesa" | "bank" | "paypal">("mpesa");
  const [f, setF] = useState<Record<string, string>>({ account_name: "", phone: "", bank_name: "", account_number: "", bank_code: "", email: "" });
  const [country, setCountry] = useState(profile?.country ?? "Kenya");
  const m = useMutation({
    mutationFn: async () => {
      const parsed = schemas[provider].safeParse(f);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the details");
      const d = parsed.data as Record<string, string>;
      let phone = d.phone;
      if (phone) phone = "+254" + phone.replace(/^(\+?254|0)/, "");
      const label = provider === "mpesa" ? "M-Pesa (KES)" : provider === "bank" ? `Bank — ${d.bank_name}` : "PayPal (USD)";
      const { error } = await supabase.from("withdrawal_methods").insert({
        user_id: user!.id, provider, label, account_name: d.account_name ?? "", phone: phone ?? null, bank_name: d.bank_name ?? null,
        account_number: d.account_number ?? null, bank_code: d.bank_code || null, email: d.email ?? null,
        country: provider === "mpesa" ? "Kenya" : country, is_default: !hasDefault, ownership_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment method added. Ownership verification is pending.");
      qc.invalidateQueries({ queryKey: ["methods"] });
      qc.invalidateQueries({ queryKey: ["verifications"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add payment method</DialogTitle><DialogDescription>The account holder name must match your verified identity.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="mpesa">M-Pesa (Kenya, KES)</SelectItem><SelectItem value="bank">Bank transfer (USD)</SelectItem><SelectItem value="paypal">PayPal (USD)</SelectItem></SelectContent>
          </Select>
          <Field label="Account holder name"><Input value={f.account_name} onChange={set("account_name")} className="h-11 rounded-xl" /></Field>
          {provider === "mpesa" && <Field label="M-Pesa phone number"><Input value={f.phone} onChange={set("phone")} placeholder="+254712345678" className="h-11 rounded-xl" /></Field>}
          {provider === "bank" && (
            <>
              <Field label="Bank name"><Input value={f.bank_name} onChange={set("bank_name")} className="h-11 rounded-xl" /></Field>
              <Field label="Account number / IBAN"><Input value={f.account_number} onChange={set("account_number")} className="h-11 rounded-xl" /></Field>
              <Field label="SWIFT / bank code (optional)"><Input value={f.bank_code} onChange={set("bank_code")} className="h-11 rounded-xl" /></Field>
            </>
          )}
          {provider === "paypal" && <Field label="PayPal email"><Input type="email" value={f.email} onChange={set("email")} className="h-11 rounded-xl" /></Field>}
          {provider !== "mpesa" && (
            <Field label="Account country">
              <Select value={country} onValueChange={setCountry}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </Field>
          )}
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={m.isPending}>Save method</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
