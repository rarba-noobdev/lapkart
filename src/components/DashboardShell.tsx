import { Link } from "@tanstack/react-router";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

export function DashboardShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background-base)] text-foreground">
      <Header />
      <section className="border-b border-[var(--border-faint)] bg-white">
        <div className="container mx-auto px-4 py-10">
          <p className="text-label-small text-[var(--heat-100)]">{eyebrow}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="font-display text-title-h3 text-foreground">{title}</h1>
              <p className="mt-2 max-w-2xl text-body-medium text-[var(--black-alpha-56)]">
                {description}
              </p>
            </div>
            <Link
              to="/products"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[var(--border-muted)] bg-white px-4 text-label-small text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
            >
              Open catalog <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
      <main className="container mx-auto px-4 py-8">{children}</main>
      <Footer />
    </div>
  );
}

export function KpiGrid({
  items,
}: {
  items: Array<{ icon: LucideIcon; label: string; value: string; trend?: string }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <MetricCard
          key={item.label}
          icon={item.icon}
          label={item.label}
          value={item.value}
          trend={item.trend}
        />
      ))}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-faint)] bg-white p-5">
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-[var(--heat-100)]" />
        {trend ? (
          <span className="text-mono-x-small uppercase tracking-[0.16em] text-[var(--accent-forest)]">
            {trend}
          </span>
        ) : (
          <span className="text-mono-x-small uppercase tracking-[0.16em] text-[var(--black-alpha-32)]">
            live
          </span>
        )}
      </div>
      <p className="mt-5 text-mono-x-small uppercase tracking-[0.18em] text-[var(--black-alpha-48)]">
        {label}
      </p>
      <p className="mt-1 font-display text-[34px] leading-none text-foreground">{value}</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-[var(--border-faint)] bg-white p-6 ${className}`}>
      <h2 className="font-display text-title-h5 text-foreground">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
