import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { COUNTRIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, JOB_CATEGORIES } from "@/lib/constants";

export type JobSearch = {
  q?: string; category?: string; country?: string; worldwide?: boolean; type?: string; level?: string;
  minSalary?: number; employer?: string; posted?: "1" | "7" | "30"; verified?: boolean; page?: number;
};

export function parseJobSearch(s: Record<string, unknown>): JobSearch {
  const str = (v: unknown, max = 100) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const num = Number(s.minSalary);
  const page = Number(s.page);
  return {
    q: str(s.q),
    category: str(s.category, 40),
    country: str(s.country, 60),
    worldwide: s.worldwide === true || s.worldwide === "true" ? true : undefined,
    type: str(s.type, 40),
    level: str(s.level, 40),
    minSalary: Number.isFinite(num) && num > 0 ? num : undefined,
    employer: str(s.employer),
    posted: s.posted === "1" || s.posted === "7" || s.posted === "30" ? s.posted : s.posted === 1 ? "1" : s.posted === 7 ? "7" : s.posted === 30 ? "30" : undefined,
    verified: s.verified === true || s.verified === "true" ? true : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  };
}

const ALL = "__all";

export function JobFilters({ value, onChange }: { value: JobSearch; onChange: (v: JobSearch) => void }) {
  const [q, setQ] = useState(value.q ?? "");
  const [open, setOpen] = useState(false);
  useEffect(() => setQ(value.q ?? ""), [value.q]);
  const set = (patch: Partial<JobSearch>) => onChange({ ...value, ...patch, page: undefined });
  const activeCount = [value.category, value.country, value.worldwide, value.type, value.level, value.minSalary, value.posted, value.verified, value.employer].filter(Boolean).length;

  const sel = (label: string, key: keyof JobSearch, options: { value: string; label: string }[]) => (
    <Select value={(value[key] as string) ?? ALL} onValueChange={(v) => set({ [key]: v === ALL ? undefined : v } as Partial<JobSearch>)}>
      <SelectTrigger className="h-10 rounded-xl bg-background" aria-label={label}><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={ALL}>{label}: Any</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim() || undefined });
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, skill or company" className="h-10 rounded-lg bg-background pl-10 text-xs" />
        </div>
        <Button type="submit" className="hidden h-10 sm:inline-flex">Search</Button>
        <Button type="button" variant="outline" className="h-10 md:hidden" onClick={() => setOpen(!open)} aria-label="Filters">
          <SlidersHorizontal /> {activeCount > 0 && activeCount}
        </Button>
      </form>
      <div className={`${open ? "grid" : "hidden"} grid-cols-2 gap-2 md:grid md:grid-cols-4 lg:grid-cols-7`}>
        {sel("Category", "category", JOB_CATEGORIES.map((c) => ({ value: c.value, label: c.label })))}
        {sel("Country", "country", COUNTRIES.map((c) => ({ value: c, label: c })))}
        {sel("Type", "type", EMPLOYMENT_TYPES.map((c) => ({ value: c, label: c })))}
        {sel("Experience", "level", EXPERIENCE_LEVELS.map((c) => ({ value: c, label: c })))}
        {sel("Posted", "posted", [{ value: "1", label: "Last 24 hours" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }])}
        <Select value={value.minSalary ? String(value.minSalary) : ALL} onValueChange={(v) => set({ minSalary: v === ALL ? undefined : Number(v) })}>
          <SelectTrigger className="h-10 rounded-xl bg-background" aria-label="Salary"><SelectValue placeholder="Salary" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Salary: Any</SelectItem>
            {[20000, 40000, 60000, 80000, 100000, 150000].map((n) => <SelectItem key={n} value={String(n)}>${n / 1000}k+ / year</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Employer" defaultValue={value.employer} onBlur={(e) => set({ employer: e.target.value.trim() || undefined })} className="h-10 rounded-xl bg-background" />
        <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm">
          <Switch checked={!!value.worldwide} onCheckedChange={(v) => set({ worldwide: v || undefined })} /> Worldwide
        </label>
        <label className="flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-sm">
          <Switch checked={!!value.verified} onCheckedChange={(v) => set({ verified: v || undefined })} /> Verified
        </label>
        {activeCount > 0 && (
          <Button type="button" variant="ghost" className="h-10" onClick={() => onChange({ q: value.q })}><X /> Clear</Button>
        )}
      </div>
    </div>
  );
}
