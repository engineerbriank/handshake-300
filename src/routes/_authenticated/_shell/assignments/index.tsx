import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardList, Search, Sparkles } from "lucide-react";
import { PageHeader, EmptyState, Loading, ErrorNote } from "@/components/common/ui-bits";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useOpenTasks, useTaskCategories, useTaskProfile } from "@/lib/task-data";
import { KIND_BY_CATEGORY, difficultyRank, recommendTasks } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_shell/assignments/")({
  head: () => ({ meta: [
    { title: "Paid Tasks — Handshake" },
    { name: "description", content: "Short, funded tasks you can complete on Handshake and get paid in USD after approval." },
    { property: "og:title", content: "Paid Tasks — Handshake" },
    { property: "og:description", content: "Short, funded tasks paid in USD after approval." },
  ] }),
  component: PaidTasksPage,
});

const SORTS = [
  { key: "recommended", label: "For you" },
  { key: "highest", label: "Highest paying" },
  { key: "lowest", label: "Lowest paying" },
  { key: "easiest", label: "Easiest" },
  { key: "shortest", label: "Shortest" },
] as const;
const KINDS = [
  { key: "all", label: "All" },
  { key: "research", label: "Research" },
  { key: "writing", label: "Writing" },
  { key: "testing", label: "Testing" },
  { key: "design", label: "Design" },
  { key: "data", label: "Data entry" },
  { key: "media", label: "Audio & video" },
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary")}>
      {children}
    </button>
  );
}

function PaidTasksPage() {
  const tasks = useOpenTasks();
  const cats = useTaskCategories();
  const prof = useTaskProfile();
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("recommended");
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const catName = useMemo(() => Object.fromEntries((cats.data ?? []).map((c) => [c.slug, c.name])), [cats.data]);

  const list = useMemo(() => {
    let rows = (tasks.data ?? []).filter((t) => t.slots_claimed < t.slots);
    if (kind !== "all") rows = rows.filter((t) => KIND_BY_CATEGORY[t.category] === kind);
    const term = q.trim().toLowerCase();
    if (term) rows = rows.filter((t) => `${t.title} ${t.description} ${t.required_skills.join(" ")}`.toLowerCase().includes(term));
    if (sort === "recommended") return prof.data ? recommendTasks(rows, prof.data) : rows;
    const by = { highest: (a: typeof rows[0], b: typeof rows[0]) => b.pay_usd - a.pay_usd, lowest: (a: typeof rows[0], b: typeof rows[0]) => a.pay_usd - b.pay_usd,
      easiest: (a: typeof rows[0], b: typeof rows[0]) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty), shortest: (a: typeof rows[0], b: typeof rows[0]) => a.estimated_minutes - b.estimated_minutes }[sort];
    return [...rows].sort(by);
  }, [tasks.data, kind, q, sort, prof.data]);

  return (
    <div>
      <PageHeader title="Paid Tasks" description="Short tasks funded in advance by Handshake or a verified sponsor. You're paid the fixed amount shown once your work is approved." actions={<Button asChild variant="outline"><Link to="/work">My Tasks</Link></Button>} />
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks or skills" className="h-12 rounded-xl pl-11" />
      </div>
      <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">{SORTS.map((s) => <Chip key={s.key} active={sort === s.key} onClick={() => setSort(s.key)}>{s.label}</Chip>)}</div>
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">{KINDS.map((k) => <Chip key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Chip>)}</div>
      {tasks.isLoading ? <Loading /> : tasks.error ? <ErrorNote error={tasks.error} /> : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{list.length} {list.length === 1 ? "task" : "tasks"} available now{sort === "recommended" && list.length > 0 && <> · <Sparkles className="inline h-3.5 w-3.5" /> best matches first</>}</p>
          {list.length === 0 ? (
            <EmptyState icon={<ClipboardList />} title={tasks.data?.length ? "No tasks match these filters" : "No funded tasks open right now"} description="Tasks only appear here once their full payment budget has been reserved. You'll get a notification when one matching your skills opens." action={<Button asChild variant="outline"><Link to="/skills">Add your skills</Link></Button>} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">{list.map((t) => <TaskCard key={t.id} task={t} categoryName={catName[t.category]} />)}</div>
          )}
        </>
      )}
    </div>
  );
}
