import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — LapKart" }] }),
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

  if (user) {
    navigate({ to: redirect || "/" });
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to verify, then sign in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: redirect || "/" });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + (redirect || "/"),
      });
      if (r.error) throw r.error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative hidden bg-[var(--gradient-hero)] p-12 text-white md:flex md:flex-col md:justify-between"
      >
        <Link to="/" className="font-display text-3xl font-bold">
          Lap<span className="text-saffron">Kart</span>
        </Link>
        <div className="space-y-4">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Every part your laptop deserves.
          </h2>
          <p className="text-white/80">
            Genuine RAM, SSDs, batteries, displays — tested, certified, delivered fast.
          </p>
          <div className="flex gap-6 pt-4 text-sm">
            <div><div className="text-2xl font-bold">10K+</div><div className="text-white/70">Parts</div></div>
            <div><div className="text-2xl font-bold">4.6★</div><div className="text-white/70">Rated</div></div>
            <div><div className="text-2xl font-bold">48h</div><div className="text-white/70">Delivery</div></div>
          </div>
        </div>
        <p className="text-xs text-white/60">© LapKart · India's laptop parts marketplace</p>
      </motion.div>

      <div className="flex items-center justify-center bg-background px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 md:hidden">
            <Link to="/" className="font-display text-2xl font-bold text-primary">
              Lap<span className="text-[color:var(--saffron)]">Kart</span>
            </Link>
          </div>
          <h1 className="font-display text-3xl font-bold">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to continue shopping." : "Join LapKart in 30 seconds."}
          </p>

          <button
            onClick={google}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6.2 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.7 35 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.5 5.5C40.9 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground shadow transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : (
                <>{mode === "login" ? "Sign in" : "Create account"} <ArrowRight className="size-4" /></>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? "New to LapKart?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
