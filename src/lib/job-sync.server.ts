import sanitizeHtml from "sanitize-html";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type NormalizedJob = {
  external_id: string;
  title: string;
  employer: string;
  employer_logo: string | null;
  description: string;
  excerpt: string | null;
  responsibilities: string | null;
  requirements: string | null;
  location: string;
  eligible_countries: string[];
  is_remote: boolean;
  worldwide: boolean;
  employment_type: string | null;
  category: string;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  skills: string[];
  deadline: string | null;
  published_at: string | null;
  apply_url: string;
  source_url: string | null;
};

const UA = "Handshake-JobSync/1.0 (+https://handshake.lovable.app)";

export function cleanHtml(html: string) {
  return sanitizeHtml(html ?? "", {
    allowedTags: ["p", "br", "ul", "ol", "li", "strong", "b", "em", "i", "h1", "h2", "h3", "h4", "a", "blockquote"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }) },
  }).trim();
}

export function plainText(html: string, max = 280) {
  const t = sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&#39;|&#039;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&hellip;/g, "…").replace(/&#8211;/g, "–");
}

function extractSection(html: string, pattern: RegExp) {
  const re = new RegExp(`<(h\\d|p|strong|b)[^>]*>(?:(?!<\\/\\1>).)*?(${pattern.source})(?:(?!<\\/\\1>).)*?<\\/\\1>(?:\\s|<\\/?(?:p|strong|b|br)[^>]*>)*\\s*(<ul>[\\s\\S]*?<\\/ul>)`, "i");
  const m = html.match(re);
  return m ? m[m.length - 1] : null;
}

const CATEGORY_RULES: [string, RegExp][] = [
  ["ai_training", /\b(ai trainer|ai training|data annotat|annotation|labell?ing|rlhf|prompt engineer|ai tutor|llm evaluat)/i],
  ["transcription", /transcri/i],
  ["translation", /translat|interpreter|locali[sz]/i],
  ["data_entry", /data entry|data clerk|typist/i],
  ["customer_support", /customer (support|service|success|experience)|support (agent|specialist|representative)|help ?desk|call cent|technical support|\bcsr\b/i],
  ["project_management", /project manag|program manag|scrum|delivery manag|product owner/i],
  ["design", /design|ux|ui\b|graphic|illustrat|figma|creative director|animator/i],
  ["writing", /writer|writing|copy ?edit|editor|content (creator|strateg|specialist)|journalis|proofread/i],
  ["marketing", /marketing|seo|sem\b|social media|growth|brand|communications|pr manager|ppc/i],
  ["sales", /sales|account executive|business develop|\bsdr\b|\bbdr\b|account manag|partnership/i],
  ["finance", /financ|accountant|accounting|bookkeep|payroll|tax|audit|controller|treasury|fp&a/i],
  ["education", /teacher|tutor|instructor|education|curriculum|teaching|professor|lecturer/i],
  ["research", /research|analyst|scientist|insights/i],
  ["administration", /admin|assistant|virtual assistant|office|coordinator|operations|\bhr\b|recruit|people partner/i],
  ["technology", /engineer|developer|devops|software|programm|data|cloud|security|it |qa|tester|architect|sre|machine learning|frontend|backend|full ?stack|mobile|android|ios/i],
];

export function classify(title: string, tags: string[] = []) {
  const hay = `${title} ${tags.join(" ")}`;
  for (const [cat, re] of CATEGORY_RULES) if (re.test(title)) return cat;
  for (const [cat, re] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return "other";
}

function normType(t: string | null | undefined) {
  if (!t) return null;
  const s = t.toLowerCase();
  if (s.includes("part")) return "Part-time";
  if (s.includes("full")) return "Full-time";
  if (s.includes("contract")) return "Contract";
  if (s.includes("freelanc")) return "Freelance";
  if (s.includes("intern")) return "Internship";
  if (s.includes("temp")) return "Temporary";
  return t.slice(0, 40);
}

function normLevel(t: string | null | undefined) {
  if (!t) return null;
  const s = t.toLowerCase();
  if (/entry|junior|graduate|intern/.test(s)) return "Entry";
  if (/mid|intermediate/.test(s)) return "Mid";
  if (/senior|sr/.test(s)) return "Senior";
  if (/lead|principal|staff|manager/.test(s)) return "Lead";
  if (/exec|director|vp|head|chief/.test(s)) return "Executive";
  return null;
}

function isWorldwideText(s: string) {
  return !s.trim() || /worldwide|anywhere|global|remote$/i.test(s.trim());
}

function splitCountries(s: string) {
  return s.split(/[,;/|]+/).map((x) => x.trim()).filter((x) => x && !/remote|anywhere|worldwide/i.test(x)).slice(0, 40);
}

function finishJob(j: Omit<NormalizedJob, "responsibilities" | "requirements" | "excerpt"> & { excerpt?: string | null }): NormalizedJob {
  const description = cleanHtml(j.description);
  return {
    ...j,
    title: decodeEntities(j.title).trim().slice(0, 250),
    employer: decodeEntities(j.employer).trim().slice(0, 200),
    description,
    excerpt: j.excerpt ? plainText(decodeEntities(j.excerpt)) : plainText(description),
    responsibilities: extractSection(description, /responsib|what you.ll do|what you will do|your role|the role|duties/) ?? null,
    requirements: extractSection(description, /requirement|qualification|what you.ll bring|what we.re looking for|who you are|you have|skills/) ?? null,
    skills: Array.from(new Set(j.skills.map((s) => s.toLowerCase().replace(/-/g, " ").trim()).filter((s) => s.length > 1 && s.length < 40))).slice(0, 12),
  };
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------- Adapters ----------
type Adapter = { slug: string; fetch: () => Promise<NormalizedJob[]>; missing?: () => string[] };

const himalayas: Adapter = {
  slug: "himalayas",
  async fetch() {
    const out: NormalizedJob[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 14; page++) {
      const url: string = `https://himalayas.app/jobs/api?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const data = (await getJson(url)) as { jobs: any[]; nextCursor?: string };
      for (const j of data.jobs ?? []) {
        if (!j.applicationLink || !j.title || !j.companyName) continue;
        const countries: string[] = j.locationRestrictions ?? [];
        out.push(
          finishJob({
            external_id: String(j.guid ?? j.applicationLink),
            title: j.title,
            employer: j.companyName,
            employer_logo: j.companyLogo ?? null,
            description: j.description ?? j.excerpt ?? "",
            excerpt: j.excerpt,
            location: countries.length ? countries.slice(0, 3).join(", ") + (countries.length > 3 ? ` +${countries.length - 3}` : "") : "Worldwide",
            eligible_countries: countries,
            is_remote: true,
            worldwide: countries.length === 0,
            employment_type: normType(j.employmentType),
            category: classify(j.title, [...(j.categories ?? []), ...(j.parentCategories ?? [])]),
            experience_level: normLevel((j.seniority ?? [])[0]),
            salary_min: j.minSalary ?? null,
            salary_max: j.maxSalary ?? null,
            salary_currency: j.currency ?? null,
            salary_period: j.minSalary || j.maxSalary ? (j.salaryPeriod ?? "annual") : null,
            skills: (j.categories ?? []).map((c: string) => c.replace(/-/g, " ")),
            deadline: j.expiryDate ? new Date(j.expiryDate * 1000).toISOString() : null,
            published_at: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
            apply_url: j.applicationLink,
            source_url: j.guid && /^https?:/.test(j.guid) ? j.guid : null,
          }),
        );
      }
      cursor = data.nextCursor ?? null;
      if (!cursor || !data.jobs?.length) break;
    }
    return out;
  },
};

const jobicy: Adapter = {
  slug: "jobicy",
  async fetch() {
    const data = (await getJson("https://jobicy.com/api/v2/remote-jobs?count=100")) as { jobs: any[] };
    return (data.jobs ?? [])
      .filter((j) => j.url && j.jobTitle && j.companyName)
      .map((j) => {
        const geo = decodeEntities(String(j.jobGeo ?? ""));
        const ww = isWorldwideText(geo);
        const countries = ww ? [] : splitCountries(geo);
        return finishJob({
          external_id: String(j.id),
          title: j.jobTitle,
          employer: j.companyName,
          employer_logo: j.companyLogo ?? null,
          description: j.jobDescription ?? j.jobExcerpt ?? "",
          excerpt: j.jobExcerpt,
          location: ww ? "Worldwide" : geo.slice(0, 120),
          eligible_countries: countries,
          is_remote: true,
          worldwide: ww,
          employment_type: normType((j.jobType ?? [])[0]),
          category: classify(decodeEntities(j.jobTitle), j.jobIndustry ?? []),
          experience_level: normLevel(j.jobLevel),
          salary_min: j.annualSalaryMin ? Number(j.annualSalaryMin) : null,
          salary_max: j.annualSalaryMax ? Number(j.annualSalaryMax) : null,
          salary_currency: j.salaryCurrency ?? null,
          salary_period: j.annualSalaryMin || j.annualSalaryMax ? "annual" : null,
          skills: (j.jobIndustry ?? []).map((s: string) => decodeEntities(s)),
          deadline: null,
          published_at: j.pubDate ? new Date(j.pubDate.replace(" ", "T") + (j.pubDate.includes("+") ? "" : "Z")).toISOString() : null,
          apply_url: j.url,
          source_url: j.url,
        });
      });
  },
};

const remoteok: Adapter = {
  slug: "remoteok",
  async fetch() {
    const data = (await getJson("https://remoteok.com/api")) as any[];
    return data
      .filter((j) => j && j.id && j.position && j.company && (j.apply_url || j.url))
      .map((j) => {
        const loc = decodeEntities(String(j.location ?? ""));
        const ww = isWorldwideText(loc);
        const salaryOk = Number(j.salary_min) > 0 || Number(j.salary_max) > 0;
        return finishJob({
          external_id: String(j.id),
          title: j.position,
          employer: j.company,
          employer_logo: j.company_logo || j.logo || null,
          description: j.description ?? "",
          location: ww ? "Worldwide" : loc.slice(0, 120),
          eligible_countries: ww ? [] : splitCountries(loc),
          is_remote: true,
          worldwide: ww,
          employment_type: null,
          category: classify(j.position, j.tags ?? []),
          experience_level: normLevel((j.tags ?? []).find((t: string) => /senior|junior|lead|exec/.test(t))),
          salary_min: salaryOk ? Number(j.salary_min) || null : null,
          salary_max: salaryOk ? Number(j.salary_max) || null : null,
          salary_currency: salaryOk ? "USD" : null,
          salary_period: salaryOk ? "annual" : null,
          skills: j.tags ?? [],
          deadline: null,
          published_at: j.date ? new Date(j.date).toISOString() : null,
          apply_url: j.apply_url || j.url,
          // Remote OK terms: link back to the original Remote OK listing
          source_url: j.url ?? `https://remoteok.com/remote-jobs/${j.slug}`,
        });
      });
  },
};

const adzuna: Adapter = {
  slug: "adzuna",
  missing: () => ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"].filter((k) => !process.env[k]),
  async fetch() {
    const id = process.env["ADZUNA_APP_ID"]!;
    const key = process.env["ADZUNA_APP_KEY"]!;
    const out: NormalizedJob[] = [];
    for (const country of ["gb", "us", "za"]) {
      const data = (await getJson(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${encodeURIComponent(id)}&app_key=${encodeURIComponent(key)}&results_per_page=50&what=remote&content-type=application/json`)) as { results: any[] };
      for (const j of data.results ?? []) {
        if (!j.redirect_url || !j.title) continue;
        out.push(
          finishJob({
            external_id: `${country}-${j.id}`,
            title: plainText(j.title, 250),
            employer: j.company?.display_name ?? "Employer not disclosed",
            employer_logo: null,
            description: `<p>${j.description ?? ""}</p>`,
            location: j.location?.display_name ?? country.toUpperCase(),
            eligible_countries: [{ gb: "United Kingdom", us: "United States", za: "South Africa" }[country]!],
            is_remote: /remote/i.test(`${j.title} ${j.description}`),
            worldwide: false,
            employment_type: normType(j.contract_time ?? j.contract_type),
            category: classify(j.title, [j.category?.label ?? ""]),
            experience_level: normLevel(j.title),
            salary_min: j.salary_min ?? null,
            salary_max: j.salary_max ?? null,
            salary_currency: j.salary_min ? ({ gb: "GBP", us: "USD", za: "ZAR" } as Record<string, string>)[country] ?? null : null,
            salary_period: j.salary_min ? "annual" : null,
            skills: [],
            deadline: null,
            published_at: j.created ?? null,
            apply_url: j.redirect_url,
            source_url: j.redirect_url,
          }),
        );
      }
    }
    return out;
  },
};

const jooble: Adapter = {
  slug: "jooble",
  missing: () => ["JOOBLE_API_KEY"].filter((k) => !process.env[k]),
  async fetch() {
    const key = process.env["JOOBLE_API_KEY"]!;
    const data = (await getJson(`https://jooble.org/api/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: "remote", location: "", page: 1, ResultOnPage: 100 }),
    })) as { jobs: any[] };
    return (data.jobs ?? [])
      .filter((j) => j.link && j.title)
      .map((j) =>
        finishJob({
          external_id: String(j.id),
          title: plainText(j.title, 250),
          employer: j.company || "Employer not disclosed",
          employer_logo: null,
          description: `<p>${j.snippet ?? ""}</p>`,
          location: j.location || "Remote",
          eligible_countries: [],
          is_remote: /remote/i.test(`${j.title} ${j.location} ${j.snippet}`),
          worldwide: /worldwide|anywhere/i.test(j.location ?? ""),
          employment_type: normType(j.type),
          category: classify(j.title),
          experience_level: normLevel(j.title),
          salary_min: null,
          salary_max: null,
          salary_currency: null,
          salary_period: null,
          skills: [],
          deadline: null,
          published_at: j.updated ?? null,
          apply_url: j.link,
          source_url: j.link,
        }),
      );
  },
};

export const ADAPTERS: Adapter[] = [himalayas, jobicy, remoteok, adzuna, jooble];

export function dedupeHash(title: string, employer: string) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${n(title)}|${n(employer)}`;
}

function validJob(j: NormalizedJob) {
  return j.title.length >= 3 && j.employer.length >= 1 && j.description.length >= 20 && /^https?:\/\//.test(j.apply_url);
}

export type SyncResult = { source: string; status: string; fetched: number; upserted: number; duplicates: number; invalid: number; expired: number; error?: string };

export async function syncSource(admin: Admin, adapter: Adapter): Promise<SyncResult> {
  const { data: source } = await admin.from("job_sources").select("*").eq("slug", adapter.slug).single();
  if (!source) return { source: adapter.slug, status: "missing_source", fetched: 0, upserted: 0, duplicates: 0, invalid: 0, expired: 0 };
  if (!source.enabled) return { source: adapter.slug, status: "disabled", fetched: 0, upserted: 0, duplicates: 0, invalid: 0, expired: 0 };
  const missing = adapter.missing?.() ?? [];
  if (missing.length) {
    await admin.from("job_sources").update({ last_status: "not_connected", last_error: `Missing credentials: ${missing.join(", ")}` }).eq("id", source.id);
    return { source: adapter.slug, status: "not_connected", fetched: 0, upserted: 0, duplicates: 0, invalid: 0, expired: 0, error: `Missing credentials: ${missing.join(", ")}` };
  }
  const { data: log } = await admin.from("job_sync_logs").insert({ source_id: source.id }).select("id").single();
  const startedAt = new Date().toISOString();
  const result: SyncResult = { source: adapter.slug, status: "ok", fetched: 0, upserted: 0, duplicates: 0, invalid: 0, expired: 0 };
  try {
    const fetched = await adapter.fetch();
    result.fetched = fetched.length;
    const now = Date.now();
    const seen = new Set<string>();
    const candidates = fetched.filter((j) => {
      if (!validJob(j)) {
        result.invalid++;
        return false;
      }
      if (j.deadline && new Date(j.deadline).getTime() < now) {
        result.invalid++;
        return false;
      }
      const h = dedupeHash(j.title, j.employer);
      if (seen.has(h)) {
        result.duplicates++;
        return false;
      }
      seen.add(h);
      return true;
    });

    // Cross-source duplicates: keep whichever source stored it first
    const hashes = candidates.map((j) => dedupeHash(j.title, j.employer));
    const taken = new Set<string>();
    for (let i = 0; i < hashes.length; i += 150) {
      const { data } = await admin.from("jobs").select("dedupe_hash").neq("source_id", source.id).eq("status", "active").in("dedupe_hash", hashes.slice(i, i + 150));
      data?.forEach((r) => taken.add(r.dedupe_hash));
    }
    const rows = candidates
      .filter((j) => {
        if (taken.has(dedupeHash(j.title, j.employer))) {
          result.duplicates++;
          return false;
        }
        return true;
      })
      .map((j) => ({ ...j, source_id: source.id, dedupe_hash: dedupeHash(j.title, j.employer), last_verified_at: startedAt, status: "active" as const, updated_at: startedAt }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin.from("jobs").upsert(rows.slice(i, i + 100), { onConflict: "source_id,external_id" });
      if (error) throw new Error(`Database upsert failed: ${error.message}`);
      result.upserted += Math.min(100, rows.length - i);
    }

    // Expire listings from this source that were not seen for 3 days, or whose deadline passed
    const staleBefore = new Date(now - 3 * 86400_000).toISOString();
    const { data: stale } = await admin.from("jobs").update({ status: "expired" }).eq("source_id", source.id).eq("status", "active").lt("last_verified_at", staleBefore).select("id");
    const { data: past } = await admin.from("jobs").update({ status: "expired" }).eq("source_id", source.id).eq("status", "active").lt("deadline", new Date().toISOString()).select("id");
    result.expired = (stale?.length ?? 0) + (past?.length ?? 0);
  } catch (e) {
    result.status = "error";
    result.error = e instanceof Error ? e.message : String(e);
    console.error(`[job-sync] ${adapter.slug} failed:`, result.error);
  }
  const { count } = await admin.from("jobs").select("id", { count: "exact", head: true }).eq("source_id", source.id).eq("status", "active");
  await admin
    .from("job_sources")
    .update({ last_sync_at: new Date().toISOString(), last_status: result.status, last_error: result.error ?? null, active_jobs: count ?? 0 })
    .eq("id", source.id);
  if (log)
    await admin
      .from("job_sync_logs")
      .update({ finished_at: new Date().toISOString(), status: result.status, fetched: result.fetched, upserted: result.upserted, duplicates: result.duplicates, invalid: result.invalid, expired: result.expired, error: result.error ?? null })
      .eq("id", log.id);
  return result;
}

export async function syncAllSources(admin: Admin, only?: string) {
  const results: SyncResult[] = [];
  for (const a of ADAPTERS) {
    if (only && a.slug !== only) continue;
    results.push(await syncSource(admin, a));
  }
  return results;
}
