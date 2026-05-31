import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, MetricCard, Panel } from "@/components/DashboardShell";
import { BadgeCheck, Boxes, Camera, TrendingUp, WandSparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vendor")({
  head: () => ({ meta: [{ title: "Vendor dashboard - LAPKART AI" }] }),
  component: VendorPage,
});

function VendorPage() {
  const stock = ["Samsung DDR4 RAM", "Crucial NVMe SSD", "Dell 65W Charger", "HP EliteBook Battery"];
  return (
    <DashboardShell
      eyebrow="vendor workspace"
      title="Sell smarter with AI stock and demand tools"
      description="Manage products, photos, inventory, orders, demand forecasts, AI generated SEO, pricing suggestions, and conversion analytics."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={TrendingUp} label="Vendor revenue" value="Rs. 8.7L" trend="+21%" />
        <MetricCard icon={Boxes} label="Active SKUs" value="248" trend="+14" />
        <MetricCard icon={BadgeCheck} label="Approval score" value="98%" trend="trusted" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Product management">
          <div className="space-y-3">
            <Link to="/ai-detection" className="flex items-center justify-between rounded-md border border-[var(--heat-100)] bg-[var(--heat-4)] p-3 text-label-small text-[var(--heat-100)]">
              <span className="inline-flex items-center gap-2"><Camera className="size-4" /> Upload component image with AI</span>
              <span className="text-mono-x-small uppercase tracking-wider">new</span>
            </Link>
            {stock.map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-[var(--border-faint)] p-3">
                <div>
                  <p className="text-label-small">{item}</p>
                  <p className="text-body-small text-[var(--black-alpha-48)]">SKU LPK-{index + 2048} / stock healthy</p>
                </div>
                <span className="rounded-sm bg-[var(--heat-8)] px-2 py-1 text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">edit</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="AI insights">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Demand prediction", "SSD demand will rise 31% next week in business laptops."],
              ["Smart pricing", "Lower DDR4 8GB by 4% to improve conversion without margin loss."],
              ["SEO generator", "Auto tags: laptop RAM, DDR4, SODIMM, Dell compatible."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                <WandSparkles className="size-4 text-[var(--heat-100)]" />
                <p className="mt-3 text-label-small">{title}</p>
                <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">{body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
