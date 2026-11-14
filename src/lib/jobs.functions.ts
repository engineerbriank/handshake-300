import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicClient } from "./public-client.server";

export const jobFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(40).optional(),
  country: z.string().max(60).optional(),
  worldwide: z.boolean().optional(),
  type: z.string().max(40).optional(),
  level: z.string().max(40).optional(),
  minSalary: z.number().min(0).max(10_000_000).optional(),
  employer: z.string().max(100).optional(),
  posted: z.enum(["1", "7", "30"]).optional(),
  verified: z.boolean().optional(),
  page: z.number().int().min(1).max(500).default(1),
  pageSize: z.number().int().min(1).max(60).default(20),
  ids: z.array(z.string().uuid()).max(200).optional(),
  skills: z.array(z.string().max(60)).max(30).optional(),
});
export type JobFilters = z.infer<typeof jobFiltersSchema>;

const LIST_COLUMNS =
  "id,title,employer,employer_logo,excerpt,location,eligible_countries,is_remote,worldwide,employment_type,category,experience_level,salary_min,salary_max,salary_currency,salary_period,skills,published_at,deadline,apply_url,is_verified,last_verified_at,source:job_sources(name,slug,website,attribution)";

export const listJobs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => jobFiltersSchema.parse(d ?? {}))
  .handler(async ({ data }) => {
    const sb = publicClient();
    let q = sb.from("jobs").select(LIST_COLUMNS, { count: "exact" }).eq("status", "active");
    if (data.q) {
      const term = data.q.replace(/[%,()]/g, " ");
      q = q.or(`title.ilike.%${term}%,employer.ilike.%${term}%,excerpt.ilike.%${term}%`);
    }
    if (data.category) q = q.eq("category", data.category);
    if (data.worldwide) q = q.eq("worldwide", true);
    if (data.country) q = q.or(`worldwide.eq.true,eligible_countries.cs.{"${data.country.replace(/"/g, "")}"}`);
    if (data.type) q = q.ilike("employment_type", `%${data.type}%`);
    if (data.level) q = q.ilike("experience_level", `%${data.level}%`);
    if (data.minSalary) q = q.or(`salary_min.gte.${data.minSalary},salary_max.gte.${data.minSalary}`);
    if (data.employer) q = q.ilike("employer", `%${data.employer.replace(/[%,]/g, " ")}%`);
    if (data.verified) q = q.eq("is_verified", true);
    if (data.posted) q = q.gte("published_at", new Date(Date.now() - Number(data.posted) * 86400_000).toISOString());
    if (data.ids) q = q.in("id", data.ids.length ? data.ids : ["00000000-0000-0000-0000-000000000000"]);
    if (data.skills?.length) q = q.overlaps("skills", data.skills.map((s) => s.toLowerCase()));
    const from = (data.page - 1) * data.pageSize;
    const { data: rows, count, error } = await q.order("published_at", { ascending: false, nullsFirst: false }).range(from, from + data.pageSize - 1);
    if (error) {
      console.error("listJobs failed", error);
      return { jobs: [], total: 0, error: "Job listings are temporarily unavailable." };
    }
    return { jobs: rows ?? [], total: count ?? 0, error: null as string | null };
  });

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: job, error } = await sb
      .from("jobs")
      .select("*, source:job_sources(name,slug,website,attribution)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) console.error("getJob failed", error);
    return job;
  });

export const jobStats = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [{ count }, { data: sources }] = await Promise.all([
    sb.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("job_sources").select("name,slug,website,last_sync_at,last_status,active_jobs,enabled,requires_credentials").order("name"),
  ]);
  return { activeJobs: count ?? 0, sources: sources ?? [] };
});
