import { format, formatDistanceToNowStrict } from "date-fns";

export function usd(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function money(value: number | string | null | undefined, currency: string) {
  if (currency === "USD") return `${usd(value)} USD`;
  const n = Number(value ?? 0);
  return `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy");
}

export function dateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy · HH:mm");
}

export function ago(value: string | Date | null | undefined) {
  if (!value) return "—";
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function humanize(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function salaryLabel(job: {
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
}) {
  const { salary_min: min, salary_max: max } = job;
  if (!min && !max) return null;
  const cur = job.salary_currency || "USD";
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const sym = cur === "USD" ? "$" : `${cur} `;
  const range = min && max && min !== max ? `${sym}${fmt(min)}–${fmt(max)}` : `${sym}${fmt((min || max)!)}`;
  const period = job.salary_period ? ` / ${job.salary_period.replace("annual", "year").replace("hourly", "hour").replace("monthly", "month")}` : "";
  return `${range}${period}`;
}

export function errorMessage(error: unknown) {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  const e = error as { message?: string; error_description?: string };
  return e.message || e.error_description || "Something went wrong";
}
