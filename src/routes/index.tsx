import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  Search, ArrowRight, Globe2, Wallet, ShieldCheck, Briefcase, ClipboardCheck, CalendarClock, Smartphone, Landmark, Lock,
  FileCheck2, Building2, Users, CheckCircle2, ScanFace,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PublicShell } from "@/components/app/PublicShell";
import { JobCard } from "@/components/jobs/JobCard";
import { EmptyState } from "@/components/common/ui-bits";
import { listJobs, jobStats } from "@/lib/jobs.functions";
import { JOB_CATEGORIES } from "@/lib/constants";

const featuredQuery = queryOptions({
  queryKey: ["landing-featured"],
  queryFn: async () => {
    const [jobs, stats] = await Promise.all([listJobs({ data: { page: 1, pageSize: 6, worldwide: true } }), jobStats()]);
    if (jobs.jobs.length < 3) {
      const any = await listJobs({ data: { page: 1, pageSize: 6 } });
      return { jobs: any.jobs, stats };
    }
    return { jobs: jobs.jobs, stats };
  },
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Handshake — Your next opportunity could be anywhere" },
      { name: "description", content: "Discover international remote opportunities, complete paid digital assignments and manage your USD earnings with weekly M-Pesa withdrawals." },
      { property: "og:title", content: "Handshake — Your next opportunity could be anywhere" },
      { property: "og:description", content: "International remote jobs, funded digital assignments and a USD wallet in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(featuredQuery),
  component: Landing,
});

const COUNTRIES_SHOWN = ["Kenya", "Nigeria", "Ghana", "Uganda", "Tanzania", "Rwanda", "South Africa", "Egypt", "India", "Philippines", "Pakistan", "United Kingdom", "United States", "Canada", "Germany", "Brazil"];

function Landing() {
  const { data } = useSuspenseQuery(featuredQuery);
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <PublicShell>
      {/* HERO */}
      <section className="bg-hero">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5 text-info" /> Global Work. Real Earnings.
            </p>
            <h1 className="text-[2.35rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.6rem]">
              YOUR NEXT OPPORTUNITY COULD BE ANYWHERE.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Discover international remote opportunities, complete paid digital assignments and manage your earnings in one place.
            </p>
            <form
              className="mt-8 flex max-w-xl items-center gap-2 rounded-2xl border bg-background p-2 shadow-raised"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/jobs", search: { q: q || undefined } });
              }}
            >
              <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Job title, skill or company" className="h-11 border-0 shadow-none focus-visible:ring-0" aria-label="Search jobs" />
              <Button type="submit" className="h-11 px-5">Search</Button>
            </form>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="hero"><Link to="/jobs">Explore Opportunities <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="heroOutline"><Link to="/auth" search={{ mode: "signup" }}>Create Account</Link></Button>
              <Button asChild size="lg" variant="ghost"><Link to="/employers">Hire Remote Talent</Link></Button>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border bg-background p-5 shadow-raised">
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/60">USD Wallet</p>
                <p className="mt-2 text-sm text-primary-foreground/80">Earnings from approved assignments are credited in USD and recorded in a double-entry ledger.</p>
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  { icon: Search, t: "Live listings", d: `${data.stats.activeJobs.toLocaleString()} active remote listings from verified sources` },
                  { icon: ClipboardCheck, t: "Funded assignments", d: "Budgets are reserved before any assignment is published" },
                  { icon: CalendarClock, t: "Weekly payouts", d: "Every Saturday at 8:00 PM East Africa Time" },
                  { icon: Smartphone, t: "M-Pesa in Kenya", d: "USD converted to KES at a documented rate" },
                ].map((i) => (
                  <li key={i.t} className="flex gap-3 rounded-xl border p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info"><i.icon className="h-4 w-4" /></span>
                    <span>
                      <span className="block font-semibold">{i.t}</span>
                      <span className="text-muted-foreground">{i.d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES / GLOBAL SEARCH */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">Search the global job market</h2>
        <p className="mt-2 text-muted-foreground">Browse by category. Every listing links to the employer's original application page.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {JOB_CATEGORIES.filter((c) => c.value !== "other").map((c) => (
            <Link key={c.value} to="/jobs" search={{ category: c.value }} className="rounded-full border bg-background px-4 py-2 text-sm font-medium hover:border-primary/30 hover:bg-secondary">
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Featured opportunities</h2>
              <p className="mt-2 text-muted-foreground">Recently published remote roles, refreshed automatically from our sources.</p>
            </div>
            <Link to="/jobs" className="hidden items-center gap-1 text-sm font-semibold sm:flex">View all <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.jobs.map((j) => <JobCard key={j.id} job={j} />)}
          </div>
          {data.jobs.length === 0 && (
            <EmptyState title="Listings are being synchronised" description="Live jobs appear here after the first synchronisation with our job sources completes." />
          )}
        </div>
      </section>

      {/* ASSIGNMENTS */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-info">Handshake Workroom</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Paid digital assignments, funded before they go live</h2>
          <p className="mt-3 text-muted-foreground">
            Handshake and approved clients publish short, well-defined digital tasks. Each assignment has clear instructions, a fixed USD payment, limited slots and a deadline. Its full budget is reserved in our ledger before anyone can claim it.
          </p>
          <Button asChild className="mt-6"><Link to="/assignments">Explore assignments</Link></Button>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2">
          {["Funded & published", "Claim a slot", "Submit your work", "Reviewed & approved", "Earnings credited", "Withdraw on Saturday"].map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
              <span className="font-semibold">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-4">
            {[
              { icon: Users, t: "Create your account", d: "Register, verify your email and complete your profile." },
              { icon: ScanFace, t: "Verify your identity", d: "Upload ID and confirm ownership of your payout account." },
              { icon: Briefcase, t: "Find work", d: "Apply to external remote jobs or claim funded assignments." },
              { icon: Wallet, t: "Get paid", d: "Approved assignment earnings land in your USD wallet." },
            ].map((s) => (
              <div key={s.t}>
                <s.icon className="h-6 w-6 text-sidebar-primary" />
                <p className="mt-3 font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-primary-foreground/70">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COUNTRIES + PAYMENTS */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">Supported countries</h2>
          <p className="mt-2 text-muted-foreground">Job discovery is open worldwide. Each listing shows the countries its employer accepts. Assignment payouts currently support:</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {COUNTRIES_SHOWN.map((c) => <span key={c} className="rounded-full bg-secondary px-3 py-1.5 text-sm">{c}</span>)}
            <span className="rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground">+ more for job discovery</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">M-Pesa payouts are for Kenya. Other payout options are added as authorised providers are connected.</p>
        </div>
        <div className="rounded-3xl border bg-card p-6 shadow-card">
          <h2 className="text-2xl font-bold">How payments work</h2>
          <ul className="mt-5 space-y-4 text-sm">
            <li className="flex gap-3"><Wallet className="mt-0.5 h-5 w-5 shrink-0 text-info" /><span><b>USD accounting.</b> Your wallet shows available, pending and reserved balances in US dollars.</span></li>
            <li className="flex gap-3"><Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-info" /><span><b>M-Pesa withdrawals.</b> Before you confirm, you see the USD amount, exchange rate, gross KES, fees and net KES.</span></li>
            <li className="flex gap-3"><CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-info" /><span><b>Weekly schedule.</b> Request anytime; payouts run every Saturday at 8:00 PM EAT. Minimum withdrawal is $5.</span></li>
            <li className="flex gap-3"><Landmark className="mt-0.5 h-5 w-5 shrink-0 text-info" /><span><b>Confirmed payouts only.</b> A withdrawal is marked paid only after the payment provider confirms it.</span></li>
          </ul>
        </div>
      </section>

      {/* BENEFITS + EMPLOYERS */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="rounded-3xl border bg-card p-6 shadow-card">
            <h2 className="text-xl font-bold">For workers</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {["One search across multiple international job sources", "Save jobs and track your applications", "Funded assignments with clear review rules", "Revision requests, appeals and disputes", "Transparent USD wallet and transaction history", "Security alerts and two-factor authentication"].map((b) => (
                <li key={b} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{b}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border bg-card p-6 shadow-card">
            <h2 className="text-xl font-bold">For employers</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {["Publish funded digital assignments to a verified workforce", "Define deliverables, revision policy and eligibility", "Review submissions and approve with one click", "Budgets held in escrow until work is approved", "Download funding invoices"].map((b) => (
                <li key={b} className="flex gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-info" />{b}</li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6"><Link to="/employers">Hire Remote Talent</Link></Button>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">Trust and security</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Lock, t: "Server-side money logic", d: "Balances can only change through audited backend transactions." },
            { icon: FileCheck2, t: "Immutable ledger", d: "Every movement is a balanced double-entry record that cannot be edited." },
            { icon: ShieldCheck, t: "Verified accounts", d: "Email, profile, identity and payout ownership checks." },
            { icon: Globe2, t: "Honest listings", d: "We never invent jobs. Each listing keeps its original source and link." },
          ].map((t) => (
            <div key={t.t} className="rounded-2xl border p-5">
              <t.icon className="h-5 w-5 text-info" />
              <p className="mt-3 font-semibold">{t.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-6">
            {[
              ["Does Handshake pay me for external jobs?", "No. External jobs are with the employer who posted them. You apply on their site and they pay you directly. Handshake only pays for Handshake assignments that you complete and that are approved."],
              ["Is employment guaranteed?", "No. We help you discover genuine opportunities, but hiring decisions are made by employers."],
              ["When are withdrawals processed?", "You can request a withdrawal at any time. Requests are processed every Saturday at 8:00 PM East Africa Time (UTC+3). The minimum is $5."],
              ["How is the KES amount calculated?", "We use a documented USD/KES exchange rate retrieved at the time of your request. You see the rate, fees and net KES before you confirm."],
              ["Can I sell or transfer my account?", "No. Accounts are personal and non-transferable. Selling accounts, credentials or balances is prohibited and leads to suspension."],
              ["What verification is required?", "Email and a completed profile to claim assignments. Identity and payout-account ownership verification before withdrawals."],
            ].map(([q = "", a]) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left">{q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </PublicShell>
  );
}
