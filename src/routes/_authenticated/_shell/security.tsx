import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Field } from "@/components/common/ui-bits";
import { MfaManager } from "@/components/common/MfaManager";

export const Route = createFileRoute("/_authenticated/_shell/security")({
  head: () => ({ meta: [{ title: "Security Centre — HANDSHAKE" }, { name: "description", content: "Password, two-factor authentication and sessions." }] }),
  component: Security,
});

function Security() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const change = useMutation({
    mutationFn: async () => {
      if (pw.length < 8 || !/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) throw new Error("Use at least 8 characters with a letter and a number.");
      if (pw !== pw2) throw new Error("Passwords do not match");
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Password updated"); setPw(""); setPw2(""); },
    onError: (e) => toast.error((e as Error).message),
  });
  const others = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Signed out of all other devices"),
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Security Centre" />
      <Panel title="Two-factor authentication"><MfaManager /></Panel>
      <Panel title="Change password">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
          <Field label="New password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm new password"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
          <Button disabled={change.isPending}>Update password</Button>
        </form>
      </Panel>
      <Panel title="Sessions">
        <p className="text-sm text-muted-foreground">If you signed in on a shared or lost device, end those sessions now.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => others.mutate()} disabled={others.isPending}>Sign out other devices</Button>
          <Button variant="ghost" asChild><Link to="/login-activity">View login activity</Link></Button>
        </div>
      </Panel>
    </div>
  );
}
