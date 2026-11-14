import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogoMark } from "@/components/brand/Logo";
import { COUNTRIES } from "@/lib/constants";
import { errorMessage } from "@/lib/format";

type AuthSearch = { mode?: "signin" | "signup" | "forgot"; redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "signup" || s.mode === "forgot" ? s.mode : undefined,
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in or create an account — HANDSHAKE" },
      { name: "description", content: "Sign in to HANDSHAKE or create your account to find remote jobs and paid assignments." },
      { property: "og:title", content: "Sign in — HANDSHAKE" },
      { property: "og:description", content: "Access your HANDSHAKE account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function SocialButtons({ redirect }: { redirect?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (provider: "google" | "apple") => {
    setBusy(provider);
    if (redirect) sessionStorage.setItem("hs_post_auth", redirect);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      toast.error(errorMessage(result.error));
      setBusy(null);
    }
  };
  return (
    <div className="grid gap-3">
      <button type="button" onClick={() => go("google")} disabled={!!busy} className="flex h-11 items-center justify-center gap-2.5 rounded-xl border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F] disabled:opacity-60">
        {busy === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleG />} Continue with Google
      </button>
      <button type="button" onClick={() => go("apple")} disabled={!!busy} className="flex h-11 items-center justify-center rounded-xl bg-[#000000] px-3 text-sm font-medium text-[#FFFFFF] disabled:opacity-60">
        {busy === "apple" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Apple"}
      </button>
    </div>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const mode = search.mode ?? "signin";

  // After OAuth or if already signed in, continue to the intended page
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const stored = sessionStorage.getItem("hs_post_auth");
        sessionStorage.removeItem("hs_post_auth");
        navigate({ to: search.redirect ?? (stored && stored.startsWith("/") ? stored : "/dashboard"), replace: true });
      }
    });
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN" && session) navigate({ to: search.redirect ?? "/dashboard", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, search.redirect]);

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="hidden w-[42%] flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <LogoMark className="h-10 w-10 bg-primary-foreground text-primary" />
          <span className="text-lg font-extrabold tracking-[0.08em]">HANDSHAKE</span>
        </Link>
        <div>
          <h2 className="text-4xl font-extrabold leading-tight">Get paid in USD for real remote work from around the world.</h2>
          <p className="mt-4 max-w-md text-primary-foreground/70">One account for international job discovery, funded digital assignments and weekly withdrawals.</p>
        </div>
        <p className="text-xs text-primary-foreground/50">Accounts are personal and non-transferable.</p>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Link to="/"><LogoMark className="h-14 w-14 lg:hidden" /></Link>
            <h1 className="mt-4 text-2xl font-bold">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back!"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "Join HANDSHAKE in a few steps" : mode === "forgot" ? "We'll email you a reset link" : "Sign in to continue"}</p>
          </div>
          <div className="rounded-3xl border bg-background p-6 shadow-card sm:p-8">
            {mode === "signup" ? <SignUpForm /> : mode === "forgot" ? <ForgotForm /> : <SignInForm redirect={search.redirect} />}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account? <Link to="/auth" search={{ redirect: search.redirect }} className="font-semibold text-foreground">Sign in</Link></>
            ) : (
              <>Don't have an account? <Link to="/auth" search={{ mode: "signup", redirect: search.redirect }} className="font-semibold text-foreground">Sign up</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function IconInput({ icon: Icon, ...props }: React.ComponentProps<typeof Input> & { icon: typeof Mail }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className="h-12 rounded-xl pl-10" />
    </div>
  );
}

function SignInForm({ redirect }: { redirect?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) toast.error(error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox." : error.message);
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <IconInput icon={Mail} type="email" placeholder="Email address" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="relative">
        <IconInput icon={Lock} type={show ? "text" : "password"} placeholder="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <div className="text-right">
        <Link to="/auth" search={{ mode: "forgot" }} className="text-sm font-medium text-muted-foreground hover:text-foreground">Forgot password?</Link>
      </div>
      <Button type="submit" className="h-12 w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Sign In</Button>
      <div className="relative py-2 text-center text-xs text-muted-foreground"><span className="relative z-10 bg-background px-2">or continue with</span><div className="absolute inset-x-0 top-1/2 border-t" /></div>
      <SocialButtons redirect={redirect} />
    </form>
  );
}

const signUpSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(60),
    middle_name: z.string().trim().max(60).optional(),
    last_name: z.string().trim().min(1, "Last name is required").max(60),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "3–30 lowercase letters, numbers or underscores"),
    email: z.string().trim().email("Enter a valid email").max(255),
    phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number with country code"),
    country: z.string().min(1, "Select your country"),
    password: z.string().min(8, "At least 8 characters").max(72).regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
    referral_code: z.string().trim().max(20).optional(),
    terms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms and Privacy Policy" }) }),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

function SignUpForm() {
  const [form, setForm] = useState({ first_name: "", middle_name: "", last_name: "", username: "", email: "", phone: "", country: "", password: "", confirm: "", referral_code: "", terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0] as string, i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    const { data: available } = await supabase.rpc("username_available", { _username: parsed.data.username });
    if (available === false) {
      setLoading(false);
      setErrors({ username: "This username is taken" });
      return;
    }
    const { password, confirm: _c, terms: _t, email, ...meta } = parsed.data;
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: meta } });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(email);
  };

  if (done)
    return (
      <div className="py-4 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-success" />
        <p className="mt-3 font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">We sent a confirmation link to <b>{done}</b>. Confirm it to activate your account, then sign in.</p>
      </div>
    );

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div><Input placeholder="First name" value={form.first_name} onChange={set("first_name")} autoComplete="given-name" className="h-11 rounded-xl" />{err("first_name")}</div>
        <div><Input placeholder="Last name" value={form.last_name} onChange={set("last_name")} autoComplete="family-name" className="h-11 rounded-xl" />{err("last_name")}</div>
      </div>
      <Input placeholder="Middle name (optional)" value={form.middle_name} onChange={set("middle_name")} autoComplete="additional-name" className="h-11 rounded-xl" />
      <div><Input placeholder="Username" value={form.username} onChange={set("username")} autoComplete="username" className="h-11 rounded-xl" />{err("username")}</div>
      <div><Input type="email" placeholder="Email address" value={form.email} onChange={set("email")} autoComplete="email" className="h-11 rounded-xl" />{err("email")}</div>
      <div><Input type="tel" placeholder="Phone (e.g. +254712345678)" value={form.phone} onChange={set("phone")} autoComplete="tel" className="h-11 rounded-xl" />{err("phone")}</div>
      <div>
        <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        {err("country")}
      </div>
      <div><Input type="password" placeholder="Password" value={form.password} onChange={set("password")} autoComplete="new-password" className="h-11 rounded-xl" />{err("password")}</div>
      <div><Input type="password" placeholder="Confirm password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" className="h-11 rounded-xl" />{err("confirm")}</div>
      <Input placeholder="Referral code (optional)" value={form.referral_code} onChange={set("referral_code")} className="h-11 rounded-xl" />
      <label className="flex items-start gap-2.5 pt-1 text-sm text-muted-foreground">
        <Checkbox checked={form.terms} onCheckedChange={(v) => setForm({ ...form, terms: v === true })} className="mt-0.5" />
        <span>I agree to the <Link to="/terms" className="font-medium text-foreground underline">Terms</Link> and <Link to="/privacy" className="font-medium text-foreground underline">Privacy Policy</Link>. My account is personal and non-transferable.</span>
      </label>
      {err("terms")}
      <Button type="submit" className="h-12 w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Create Account</Button>
      <div className="relative py-2 text-center text-xs text-muted-foreground"><span className="relative z-10 bg-background px-2">or continue with</span><div className="absolute inset-x-0 top-1/2 border-t" /></div>
      <SocialButtons />
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
  };
  if (sent) return <p className="text-center text-sm text-muted-foreground">If an account exists for <b>{email}</b>, a reset link is on its way.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <IconInput icon={Mail} type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" className="h-12 w-full" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Send reset link</Button>
      <Link to="/auth" className="block text-center text-sm font-medium text-muted-foreground">Back to sign in</Link>
    </form>
  );
}
