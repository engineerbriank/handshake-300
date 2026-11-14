import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "./auth";

export function useWallet() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type LedgerLine = { id: string; amount: number; created_at: string; kind: string; description: string; external_reference: string | null };

export function useTransactions(limit = 50) {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["transactions", user?.id, limit],
    enabled: !!user,
    queryFn: async (): Promise<LedgerLine[]> => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("id,debit,credit,created_at,account:ledger_accounts!inner(code),txn:ledger_transactions!inner(kind,description,external_reference)")
        .like("account.code", "USER_AVAILABLE:%")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((e) => {
        const t = e.txn as unknown as { kind: string; description: string; external_reference: string | null };
        return { id: e.id, amount: Number(e.credit) - Number(e.debit), created_at: e.created_at, kind: t.kind, description: t.description, external_reference: t.external_reference };
      });
    },
  });
}

export function useClaims() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["claims", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assignment_claims")
        .select("*, assignment:assignments(id,title,pay_usd,deadline,max_revisions,category,submission_types,verification_checklist,deliverables)")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useApplications() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["applications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*, job:jobs(id,title,employer,employer_logo,status,apply_url)")
        .eq("user_id", user!.id)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVerifications() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["verifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_verifications").select("*").eq("user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotifications(limit = 50) {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["notifications", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWithdrawalMethods() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["methods", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawal_methods").select("*").eq("user_id", user!.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWithdrawals() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("withdrawal_requests").select("*, method:withdrawal_methods(label,provider)").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export const TXN_LABEL: Record<string, string> = {
  assignment_earning: "Assignment payment",
  withdrawal_reserve: "Withdrawal reserved",
  withdrawal_release: "Withdrawal cancelled — returned",
  withdrawal_reversal: "Payout failed — returned",
  adjustment: "Adjustment",
};
