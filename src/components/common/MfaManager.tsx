import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function useMfa() {
  return useQuery({
    queryKey: ["mfa"],
    queryFn: async () => {
      const [{ data: factors }, { data: aal }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
      return { totp: (factors?.totp ?? []).filter((f) => f.status === "verified"), current: aal?.currentLevel ?? "aal1", next: aal?.nextLevel ?? "aal1" };
    },
  });
}

/** Enroll a TOTP authenticator, or verify one to reach aal2 for this session. */
export function MfaManager({ onVerified }: { onVerified?: () => void }) {
  const qc = useQueryClient();
  const { data } = useMfa();
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  const start = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: d, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `HANDSHAKE ${new Date().toISOString().slice(0, 10)}` });
      if (error) throw error;
      return { id: d.id, qr: d.totp.qr_code, secret: d.totp.secret };
    },
    onSuccess: setEnroll,
    onError: (e) => toast.error((e as Error).message),
  });
  const verify = useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Two-factor authentication verified");
      setEnroll(null);
      setCode("");
      qc.invalidateQueries();
      onVerified?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Authenticator removed"); qc.invalidateQueries({ queryKey: ["mfa"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const codeInput = (factorId: string) => (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); verify.mutate(factorId); }}>
      <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" inputMode="numeric" className="w-40" autoFocus />
      <Button disabled={code.length !== 6 || verify.isPending}>{verify.isPending && <Loader2 className="animate-spin" />} Verify</Button>
    </form>
  );

  if (enroll)
    return (
      <div className="space-y-3">
        <p className="text-sm">Scan this QR code with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code.</p>
        <img src={enroll.qr} alt="Authenticator QR code" className="h-44 w-44 rounded-xl border bg-background p-2" />
        <p className="text-xs text-muted-foreground">Or enter this key: <code className="break-all font-mono">{enroll.secret}</code></p>
        {codeInput(enroll.id)}
      </div>
    );

  if (data?.totp.length) {
    const f = data.totp[0]!;
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-success"><ShieldCheck className="h-4 w-4" /> Authenticator app enabled</p>
        {data.current !== "aal2" ? (
          <><p className="text-sm text-muted-foreground">Enter a code to verify this session.</p>{codeInput(f.id)}</>
        ) : (
          <Button variant="outline" size="sm" onClick={() => confirm("Remove two-factor authentication? Admin access will require it again.") && remove.mutate(f.id)}>Remove authenticator</Button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Add a second step at sign-in using an authenticator app.</p>
      <Button onClick={() => start.mutate()} disabled={start.isPending}>{start.isPending && <Loader2 className="animate-spin" />} Set up authenticator</Button>
    </div>
  );
}
