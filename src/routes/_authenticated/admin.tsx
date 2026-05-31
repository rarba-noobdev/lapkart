import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell, KpiGrid, Panel } from "@/components/DashboardShell";
import { detectionApiBase, type ComponentDetection } from "@/lib/component-detection";
import { analyticsSeries, commerceModules, rolePanels } from "@/lib/marketplace";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard - LAPKART AI" },
      { name: "description", content: "Manage users, vendors, products, orders, delivery, refunds, analytics, and AI insights." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [detections, setDetections] = useState<ComponentDetection[]>([]);

  useEffect(() => {
    fetch(`${detectionApiBase}/components/detections`)
      .then((response) => response.ok ? response.json() : Promise.reject(response))
      .then((payload: { detections: ComponentDetection[] }) => setDetections(payload.detections ?? []))
      .catch(() => setDetections([]));
  }, []);

  return (
    <DashboardShell
      eyebrow="admin command center"
      title="LAPKART AI operations cockpit"
      description="Marketplace controls for revenue, orders, users, vendors, delivery partners, refunds, fraud alerts, and AI automation."
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
            {["Approve 18 vendors", "Assign 42 deliveries", "Review 7 refunds", "Resolve 4 fraud alerts"].map((item) => (
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
        <Panel title="AI automation map">
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
        <Panel title="Component detection approvals">
          <div className="space-y-3">
            {detections.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--border-muted)] p-6 text-center text-body-small text-[var(--black-alpha-56)]">
                No component detections loaded yet. Run AI Detect after applying the Supabase migration and API service role key.
              </p>
            ) : (
              detections.slice(0, 6).map((item) => (
                <div key={item.id} className="flex gap-3 rounded-md border border-[var(--border-faint)] p-3">
                  <img src={item.image_url} alt={item.component_name} className="size-16 rounded-md border border-[var(--border-faint)] object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-label-small">{item.component_name}</p>
                    <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">
                      {item.brand} / {item.category} / {item.confidence_score}% confidence
                    </p>
                    <p className="mt-1 text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">{item.status}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel title="Detection accuracy report">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Avg confidence", detections.length ? `${Math.round(detections.reduce((sum, item) => sum + Number(item.confidence_score ?? 0), 0) / detections.length)}%` : "0%"],
              ["Pending approvals", String(detections.filter((item) => item.status !== "product_created").length)],
              ["Products created", String(detections.filter((item) => item.status === "product_created").length)],
              ["OCR coverage", detections.some((item) => item.ocr_text) ? "Active" : "Waiting"],
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
