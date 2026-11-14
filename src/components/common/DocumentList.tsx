import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Link2, Trash2, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/ui-bits";
import { useCurrentUser } from "@/lib/auth";
import { uploadPrivate, validateFile, openPrivate, ALLOWED_TYPES } from "@/lib/upload";
import { shortDate } from "@/lib/format";

export function DocumentList({ category, allowLinks, kinds }: { category: "cv" | "portfolio"; allowLinks?: boolean; kinds: (keyof typeof ALLOWED_TYPES)[] }) {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const q = useQuery({
    queryKey: ["docs", category, user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("user_documents").select("*").eq("user_id", user!.id).eq("category", category).order("created_at", { ascending: false })).data ?? [],
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const err = validateFile(file, kinds);
      if (err) throw new Error(err);
      const path = await uploadPrivate(user!.id, category, file);
      const { error } = await supabase.from("user_documents").insert({ user_id: user!.id, category, title: (title.trim() || file.name).slice(0, 150), file_path: path, mime_type: file.type, size_bytes: file.size });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Uploaded"); setTitle(""); qc.invalidateQueries({ queryKey: ["docs", category] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const addLink = useMutation({
    mutationFn: async () => {
      if (!/^https?:\/\/\S+$/.test(url.trim())) throw new Error("Enter a full link starting with https://");
      const { error } = await supabase.from("user_documents").insert({ user_id: user!.id, category, title: (title.trim() || url.trim()).slice(0, 150), url: url.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setUrl(""); qc.invalidateQueries({ queryKey: ["docs", category] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (d: { id: string; file_path: string | null }) => {
      if (d.file_path) await supabase.storage.from("documents").remove([d.file_path]);
      const { error } = await supabase.from("user_documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["docs", category] }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-card">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload file
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          </label>
          {allowLinks && (
            <div className="flex flex-1 gap-2">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-work.example" className="min-w-0" />
              <Button variant="outline" onClick={() => addLink.mutate()} disabled={!url}>Add link</Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Files are stored privately. Max 10 MB. Allowed: {kinds.join(", ")}.</p>
      </div>
      {q.data?.length ? (
        <ul className="space-y-2">
          {q.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              {d.url ? <Link2 className="h-5 w-5 text-info" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => (d.url ? window.open(d.url, "_blank", "noopener") : d.file_path && openPrivate(d.file_path))}>
                <span className="block truncate font-medium hover:underline">{d.title}</span>
                <span className="text-xs text-muted-foreground">Added {shortDate(d.created_at)}{d.size_bytes ? ` · ${(d.size_bytes / 1024 / 1024).toFixed(1)} MB` : ""}</span>
              </button>
              <button type="button" onClick={() => del.mutate(d)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing uploaded yet" />
      )}
    </div>
  );
}
