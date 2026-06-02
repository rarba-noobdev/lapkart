import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, KpiGrid, Panel } from "@/components/DashboardShell";
import { analyticsSeries, commerceModules, rolePanels } from "@/lib/marketplace";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard - LapKart" },
      { name: "description", content: "Manage users, products, orders, payments, refunds, analytics, and reports." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <DashboardShell
      eyebrow="admin command center"
      title="LapKart operations cockpit"
      description="Marketplace controls for revenue, orders, users, products, payments, refunds, stock, and reports."
    >
      <KpiGrid />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Revenue and order trend">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsSeries}>
                <defs>
                  <linearGradient id="lapkartRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#f97316" fill="url(#lapkartRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Admin queues">
          <div className="space-y-3">
            {["Review 18 product updates", "Check 42 open orders", "Review 7 refunds", "Resolve 4 payment alerts"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-[var(--border-faint)] p-3">
                <span className="text-label-small">{item}</span>
                <span className="text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">live</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Role management">
          <div className="grid gap-3 sm:grid-cols-2">
            {rolePanels.map(({ role, title, icon: Icon, metrics }) => (
              <div key={role} className="rounded-md border border-[var(--border-faint)] p-4">
                <Icon className="size-5 text-[var(--heat-100)]" />
                <p className="mt-3 text-label-medium">{role}</p>
                <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{title}</p>
                <p className="mt-3 text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{metrics.join(" / ")}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Operations map">
          <div className="space-y-3">
            {commerceModules.map(({ title, body, icon: Icon }) => (
              <div key={title} className="flex gap-3 rounded-md border border-[var(--border-faint)] p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-[var(--heat-100)]" />
                <div>
                  <p className="text-label-small">{title}</p>
                  <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Catalog controls">
          <div className="space-y-3">
            {["Publish approved SKUs", "Update stock counts", "Review price changes", "Audit low-stock categories"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-[var(--border-faint)] p-3">
                <span className="text-label-small">{item}</span>
                <span className="text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">admin</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Role controls">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Allowed roles", "admin / user"],
              ["Signup default", "user"],
              ["Client role edits", "blocked"],
              ["Admin promotion", "database only"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                <p className="text-mono-x-small uppercase tracking-wider text-[var(--black-alpha-48)]">{label}</p>
                <p className="mt-2 font-display text-[28px] leading-none">{value}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
