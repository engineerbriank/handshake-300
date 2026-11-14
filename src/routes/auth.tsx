import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
      { title: "Sign in or create an account — Handshake" },
      { name: "description", content: "Sign in to Handshake or create your account to find remote jobs and paid assignments." },
      { property: "og:title", content: "Sign in — Handshake" },
      { property: "og:description", content: "Access your Handshake account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

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
    <main className={`auth-screen flex min-h-dvh flex-col items-center px-5 ${mode === "signup" ? "bg-background" : ""}`}>
      <div className="w-full max-w-[400px] flex-1 pb-6 pt-12 sm:pt-16">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link to="/"><LogoMark className="h-[72px] w-[72px]" /></Link>
          <p className="mt-3 text-[36px] font-bold leading-tight">Handshake</p>
          <h1 className="mt-2 text-2xl font-bold">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome Back!"}</h1>
          <p className="mt-1 text-base text-muted-foreground">{mode === "signup" ? "Let’s get started. Fill in your basic details." : mode === "forgot" ? "We'll email you a reset link" : "Sign in to continue"}</p>
        </div>
        {mode === "signup" ? <SignUpForm /> : mode === "forgot" ? <ForgotForm /> : <SignInForm />}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signup" ? < >Already have an account? <Link to="/auth" search={{ redirect: search.redirect }} className="font-semibold text-brand">Sign in</Link></> : <>Don't have an account? <Link to="/auth" search={{ mode: "signup", redirect: search.redirect }} className="font-semibold text-brand">Sign up</Link></>}
        </p>
      </div>
      <div className="home-indicator" />
    </main>
  );
}

function IconInput({ icon: Icon, ...props }: React.ComponentProps<typeof Input> & { icon: typeof Mail }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className="h-12 rounded-xl pl-11 text-[15px]" />
    </div>
  );
}

function SignInForm() {
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
        <Button variant="ghost" size="icon" type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <div className="text-right">
        <Link to="/auth" search={{ mode: "forgot" }} className="text-sm font-medium text-info hover:text-foreground">Forgot password?</Link>
      </div>
      <Button type="submit" className="h-12 w-full text-base" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Sign In</Button>
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
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      const parsedStep = signUpSchema.safeParse({ ...form, country: form.country || "Kenya", terms: true });
      const keys = step === 1 ? ["first_name", "last_name", "username", "email", "phone"] : ["password", "confirm"];
      const issues = parsedStep.success ? [] : parsedStep.error.issues.filter((i) => keys.includes(String(i.path[0])));
      if (issues.length) { setErrors(Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]))); return; }
      setErrors({}); setStep(step + 1); return;
    }
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
      <div className="mb-5">
        <p className="mb-2 text-center text-sm text-info">{step} of 3</p>
        <div className="grid grid-cols-3 gap-1">{[1, 2, 3].map((i) => <div key={i} className={`h-1 rounded-full ${i <= step ? "bg-brand" : "bg-secondary"}`} />)}</div>
        <h2 className="mt-5 text-2xl font-bold">{step === 1 ? "Create your account" : step === 2 ? "Set your password" : "Complete your profile"}</h2>
        <p className="mt-1 text-[15px] text-muted-foreground">{step === 1 ? "Fill in your basic details." : step === 2 ? "Create a strong password to keep your account safe." : "Tell us more about yourself. Verification continues after email confirmation."}</p>
      </div>
      {step === 1 && <>
        {([ ["first_name", "First name", "e.g. John"], ["last_name", "Last name", "e.g. Doe"], ["middle_name", "Middle name (optional)", "e.g. Kamau"], ["username", "Username", "Choose a unique username"], ["email", "Email address", "you@example.com"], ["phone", "Phone number", "+254 712345678"] ] as const).map(([key, label, placeholder]) => (
          <label key={key} className="block rounded-xl border px-4 py-2.5"><span className="text-sm font-medium">{label}</span><Input aria-label={label} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} placeholder={placeholder} value={form[key]} onChange={set(key)} className="h-7 border-0 px-0 text-[15px] shadow-none focus-visible:ring-0" />{err(key)}</label>
        ))}
      </>}
      {step === 2 && <>
        <label className="block rounded-xl border px-4 py-2.5"><span className="text-sm font-medium">Password</span><Input aria-label="Password" type="password" placeholder="Min 8 characters, including a letter and number" value={form.password} onChange={set("password")} autoComplete="new-password" className="h-8 border-0 px-0 text-[15px] shadow-none focus-visible:ring-0" />{err("password")}</label>
        <label className="block rounded-xl border px-4 py-2.5"><span className="text-sm font-medium">Confirm password</span><Input aria-label="Confirm password" type="password" placeholder="Re-enter your password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" className="h-8 border-0 px-0 text-[15px] shadow-none focus-visible:ring-0" />{err("confirm")}</label>
        <p className="pt-2 text-[15px] font-medium">Password must include:</p>
        <ul className="space-y-2 text-sm text-muted-foreground"><li className={form.password.length >= 8 ? "text-success" : ""}>✓ At least 8 characters</li><li className={/[A-Za-z]/.test(form.password) ? "text-success" : ""}>✓ One letter</li><li className={/[0-9]/.test(form.password) ? "text-success" : ""}>✓ One number</li></ul>
      </>}
      {step === 3 && <>
        <label className="block space-y-1.5 text-sm font-medium">Country<Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}><SelectTrigger className="h-12 rounded-xl text-[15px]"><SelectValue placeholder="Select country" /></SelectTrigger><SelectContent className="max-h-72">{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>{err("country")}</label>
        <Input placeholder="Referral code (optional)" value={form.referral_code} onChange={set("referral_code")} className="h-12 rounded-xl text-[15px]" />
        <label className="flex items-start gap-2.5 pt-1 text-sm text-muted-foreground"><Checkbox checked={form.terms} onCheckedChange={(v) => setForm({ ...form, terms: v === true })} className="mt-0.5" /><span>I agree to the <Link to="/terms" className="font-medium text-foreground underline">Terms</Link> and <Link to="/privacy" className="font-medium text-foreground underline">Privacy Policy</Link>. My account is personal and non-transferable.</span></label>
        {err("terms")}
      </>}
      <div className="flex items-center gap-4 pt-5">
        {step > 1 && <Button type="button" variant="ghost" onClick={() => { setStep(step - 1); setErrors({}); }}>Back</Button>}
        <Button variant="brand" type="submit" className="h-12 flex-1 text-base" disabled={loading}>{loading && <Loader2 className="animate-spin" />}{step === 3 ? "Create Account" : "Next →"}</Button>
      </div>
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
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };
  if (sent) return <p className="text-center text-sm text-muted-foreground">If an account exists for <b>{email}</b>, a reset link is on its way.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <IconInput icon={Mail} type="email" placeholder="Email address" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" className="h-12 w-full text-base" disabled={loading}>{loading && <Loader2 className="animate-spin" />} Send reset link</Button>
      <Link to="/auth" className="block text-center text-sm font-medium text-muted-foreground">Back to sign in</Link>
    </form>
  );
}
