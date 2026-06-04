import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, Lock, ArrowRight, Flame, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in - lapkart" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const redirectPath = redirect?.startsWith("/") ? redirect : "/";

  useEffect(() => {
    if (user) navigate({ to: redirectPath });
  }, [navigate, redirectPath, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name.trim() || normalizedEmail.split("@")[0] },
          },
        });

        if (error) throw error;
        toast.success("Account created. Check your email, then sign in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: redirectPath });
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirectPath}`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1.05fr]">
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative hidden overflow-hidden bg-[var(--accent-black)] p-12 text-white grain md:flex md:flex-col md:justify-between"
      >
        <div className="pointer-events-none absolute -left-20 -top-40 h-[460px] w-[460px] rounded-full bg-[var(--heat-100)] opacity-25 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-[var(--heat-200)] opacity-12 blur-[100px]" />

        <Link to="/" className="relative z-10 flex items-baseline gap-2">
          <Flame className="size-6 text-[var(--heat-100)]" strokeWidth={2.4} />
          <span className="font-display text-[28px] font-medium tracking-[-0.02em] text-white">
            lap<span className="text-[var(--heat-100)]">kart</span>
          </span>
        </Link>

        <div className="relative z-10 space-y-8">
          <span className="text-label-small text-white/65">Secure account access</span>
          <h2 className="font-display text-title-h2 leading-[1.05] text-balance text-white">
            Every part your laptop deserves.
            <br />
            <span className="text-[var(--heat-100)]">Delivered fast.</span>
          </h2>
          <p className="max-w-md text-body-large text-white/65">
            Sign in to track orders, save addresses, and check out faster when the right part is in
            stock.
          </p>
        </div>

        <p className="relative z-10 text-mono-x-small uppercase tracking-[0.18em] text-white/35">
          LapKart account access
        </p>
      </motion.aside>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px]"
        >
          <Link to="/" className="mb-10 flex items-baseline gap-2 md:hidden">
            <Flame className="size-5 text-[var(--heat-100)]" strokeWidth={2.4} />
            <span className="font-display text-[22px] font-medium tracking-[-0.02em]">
              lap<span className="text-[var(--heat-100)]">kart</span>
            </span>
          </Link>

          <span className="text-label-small text-[var(--heat-100)]">
            {mode === "login" ? "Sign in" : "Create account"}
          </span>
          <h1 className="mt-2 font-display text-title-h3 text-foreground">
            {mode === "login" ? "Welcome back" : "Join lapkart"}
          </h1>
          <p className="mt-2 text-body-medium text-[var(--black-alpha-56)]">
            {mode === "login"
              ? "Sign in to continue shopping for parts."
              : "Create an account in 30 seconds."}
          </p>

          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="mt-8 flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-[var(--border-muted)] bg-white px-4 text-label-medium text-foreground transition-[border-color,background-color,color] hover:border-[var(--heat-20)] hover:bg-[var(--heat-4)] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.7 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.5 5.5C40.9 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-mono-x-small uppercase tracking-[0.22em] text-[var(--black-alpha-40)]">
            <span className="h-px flex-1 bg-[var(--border-muted)]" />
            or with email
            <span className="h-px flex-1 bg-[var(--border-muted)]" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <FormField icon={User} label="Full name">
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 w-full bg-transparent pl-10 pr-3 text-body-medium"
                />
              </FormField>
            )}

            <FormField icon={Mail} label="Email address">
              <input
                type="email"
                required
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full bg-transparent pl-10 pr-3 text-body-medium"
              />
            </FormField>

            <FormField icon={Lock} label="Password">
              <input
                type="password"
                required
                name="password"
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full bg-transparent pl-10 pr-3 text-body-medium"
              />
            </FormField>

            <button
              type="submit"
              disabled={busy}
              className="button button-primary mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-md text-label-medium disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign in" : "Create account"}{" "}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-body-small text-[var(--black-alpha-56)]">
            {mode === "login" ? "New to lapkart?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-medium text-[var(--heat-100)] hover:underline"
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function FormField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-label-small text-foreground">{label}</span>
      <div className="relative rounded-md border border-[var(--border-muted)] bg-[var(--background-lighter)] transition-[border-color,background-color,box-shadow] focus-within:border-[var(--heat-100)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_var(--heat-12)]">
        <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--black-alpha-40)]" />
        {children}
      </div>
    </label>
  );
}
