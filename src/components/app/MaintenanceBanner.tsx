import { useQuery } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("key,value");
      return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, unknown>;
    },
  });
}

export function MaintenanceBanner() {
  const { data } = useSettings();
  if (data?.maintenance_mode !== true) return null;
  return (
    <div className="mb-5 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
      <Wrench className="h-4 w-4" /> {String(data.maintenance_message ?? "Scheduled maintenance in progress.")}
    </div>
  );
}
