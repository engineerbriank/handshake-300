import { Link } from "@tanstack/react-router";
import { Clock, Users, CalendarClock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usd, shortDate, humanize } from "@/lib/format";
import { difficultyLabel, hourlyEquivalent, SUBMISSION_LABEL } from "@/lib/tasks";

export type TaskCardData = {
  id: string; title: string; description: string; pay_usd: number; slots: number; slots_claimed: number; deadline: string;
  estimated_minutes: number; category: string; required_skills: string[]; difficulty: string | null; submission_types: string[];
};

export function TaskCard({ task, categoryName }: { task: TaskCardData; categoryName?: string }) {
  const left = task.slots - task.slots_claimed;
  return (
    <Link to="/assignments/$assignmentId" params={{ assignmentId: task.id }} className="block min-w-0 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{categoryName ?? humanize(task.category)}</p>
          <h3 className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug">{task.title}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-lg font-bold text-success">{usd(task.pay_usd)}</p>
          <p className="text-xs text-muted-foreground">fixed pay</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="muted">{difficultyLabel(task.difficulty)}</Badge>
        {task.required_skills.slice(0, 3).map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 shrink-0" /> ~{task.estimated_minutes} min · ≈{usd(hourlyEquivalent(Number(task.pay_usd), task.estimated_minutes))}/hr</span>
        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /> {left > 0 ? `${left} of ${task.slots} slots left` : "All slots claimed"}</span>
        <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 shrink-0" /> Due {shortDate(task.deadline)}</span>
        <span className="flex min-w-0 items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{task.submission_types.map((t) => SUBMISSION_LABEL[t] ?? humanize(t)).join(", ")}</span></span>
      </div>
    </Link>
  );
}
