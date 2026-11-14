import { supabase } from "@/integrations/supabase/client";

export const ALLOWED_TYPES: Record<string, string[]> = {
  document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
  image: ["image/png", "image/jpeg", "image/webp"],
  archive: ["application/zip", "application/x-zip-compressed"],
  spreadsheet: ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.oasis.opendocument.spreadsheet"],
  audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
};
export const MAX_BYTES = 10 * 1024 * 1024;

export function validateFile(file: File, kinds: (keyof typeof ALLOWED_TYPES)[]) {
  const allowed = kinds.flatMap((k) => ALLOWED_TYPES[k]);
  if (!allowed.includes(file.type)) return `Unsupported file type. Allowed: ${kinds.join(", ")}.`;
  if (file.size > MAX_BYTES) return "File is larger than 10 MB.";
  if (file.size === 0) return "File is empty.";
  return null;
}

export async function uploadPrivate(userId: string, folder: string, file: File) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
  const path = `${userId}/${folder}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function openPrivate(path: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, "_blank", "noopener");
}
