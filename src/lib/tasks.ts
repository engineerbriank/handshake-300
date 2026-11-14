/** Shared, browser-safe helpers for Paid Tasks. Money rules are enforced in the database; these only describe them. */

export const DIFFICULTIES = [
  { value: "very_simple", label: "Very simple", rank: 1 },
  { value: "basic", label: "Basic", rank: 2 },
  { value: "standard", label: "Standard", rank: 3 },
  { value: "intermediate", label: "Intermediate", rank: 4 },
  { value: "advanced", label: "Advanced", rank: 5 },
  { value: "specialized", label: "Specialized", rank: 6 },
  { value: "expert", label: "Expert", rank: 7 },
] as const;
export type Difficulty = (typeof DIFFICULTIES)[number]["value"];

export function difficultyLabel(d: string | null | undefined) {
  return DIFFICULTIES.find((x) => x.value === d)?.label ?? "Standard";
}
export function difficultyRank(d: string | null | undefined) {
  return DIFFICULTIES.find((x) => x.value === d)?.rank ?? 3;
}

/** Fixed pay expressed per hour, for comparison only — tasks never pay hourly. */
export function hourlyEquivalent(payUsd: number, minutes: number) {
  if (!(minutes > 0) || !(payUsd > 0)) return 0;
  return Math.round((payUsd * 60 / minutes) * 100) / 100;
}

/** How many paid slots an amount of unallocated funding fully covers. */
export function coveredSlots(availableUsd: number, payUsd: number) {
  if (!(payUsd > 0) || !(availableUsd > 0)) return 0;
  return Math.floor((Math.round(availableUsd * 100)) / Math.round(payUsd * 100));
}

export function budgetFor(payUsd: number, slots: number) {
  return Math.round(payUsd * 100 * slots) / 100;
}

export const SUBMISSION_LABEL: Record<string, string> = {
  text: "Written response", file: "File upload", url: "Link", image: "Image or screenshot", spreadsheet: "Spreadsheet",
  document: "PDF or document", audio: "Audio", video: "Video", form: "Structured form",
};
export const FILE_SUBMISSION_TYPES = ["file", "image", "spreadsheet", "document", "audio", "video"];

export type TaskLike = {
  status: string; paused?: boolean | null; deadline: string; slots: number; slots_claimed: number; publish_at?: string | null;
};
export type TaskState = "draft" | "funded" | "scheduled" | "published" | "full" | "paused" | "expired" | "closed";

export function taskState(t: TaskLike, now = new Date()): TaskState {
  if (t.status === "draft") return "draft";
  if (t.status === "closed" || t.status === "cancelled") return "closed";
  if (t.paused) return "paused";
  if (t.status === "funded") return "funded";
  if (new Date(t.deadline) <= now) return "expired";
  if (t.slots_claimed >= t.slots) return "full";
  if (t.publish_at && new Date(t.publish_at) > now) return "scheduled";
  return "published";
}

export const TASK_STATE_LABEL: Record<TaskState, string> = {
  draft: "Unfunded draft", funded: "Funded", scheduled: "Scheduled", published: "Open", full: "Fully claimed", paused: "Paused", expired: "Expired", closed: "Closed",
};

/** Filter chips on the Paid Tasks page, mapped to catalogue category kinds. */
export const KIND_BY_CATEGORY: Record<string, string> = {
  data_entry: "data", ecommerce: "data", spreadsheets: "data",
  online_research: "research", surveys: "research", business_verification: "research", seo_research: "research",
  writing: "writing", translation: "writing", social_media: "writing", education: "writing", tech_docs: "writing",
  transcription: "media", audio_video: "media",
  graphic_design: "design",
  software_qa: "testing", web_usability: "testing", app_usability: "testing", accessibility: "testing",
  support_simulation: "support",
};

export type RecTask = TaskLike & { id: string; category: string; required_skills: string[]; eligible_countries: string[]; pay_usd: number; estimated_minutes: number; difficulty?: string | null };
export type RecProfile = { skills: string[]; country: string | null; completedCategories: Record<string, number>; rejectedCategories?: Record<string, number> };

/** Scores open tasks for a user; returns -1 when the user cannot take the task (country or closed). */
export function scoreTask(t: RecTask, p: RecProfile, now = new Date()) {
  if (taskState(t, now) !== "published") return -1;
  if (t.eligible_countries.length && (!p.country || !t.eligible_countries.includes(p.country))) return -1;
  const skills = new Set(p.skills.map((s) => s.toLowerCase()));
  const req = t.required_skills.map((s) => s.toLowerCase());
  const matched = req.filter((s) => skills.has(s)).length;
  let score = req.length ? (matched / req.length) * 50 : 10;
  score += Math.min(20, (p.completedCategories[t.category] ?? 0) * 5);
  score -= Math.min(15, (p.rejectedCategories?.[t.category] ?? 0) * 5);
  if (!p.skills.length) score += Math.max(0, 8 - difficultyRank(t.difficulty)) * 2; // newcomers: easier first
  score += Math.min(10, (t.slots - t.slots_claimed) / 10);
  return Math.round(score * 10) / 10;
}

export function recommendTasks<T extends RecTask>(tasks: T[], p: RecProfile, now = new Date()) {
  return tasks
    .map((t) => ({ t, s: scoreTask(t, p, now) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || b.t.pay_usd - a.t.pay_usd)
    .map((x) => x.t);
}
