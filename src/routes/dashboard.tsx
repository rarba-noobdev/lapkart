import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell, Panel } from "@/components/DashboardShell";
import { aiPrediction, repairPrediction } from "@/lib/marketplace";
import { Heart, ImageUp, PackageCheck, UserRound, Wrench } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Customer dashboard - LAPKART AI" }] }),
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const tiles = [
    { icon: PackageCheck, label: "Orders", body: "2 active / 12 delivered" },
    { icon: Heart, label: "Wishlist", body: "18 saved products" },
    { icon: Wrench, label: "Repairs", body: "1 technician assigned" },
    { icon: UserRound, label: "Profile", body: "3 addresses / 2 payment methods" },
  ];

  return (
    <DashboardShell
      eyebrow="customer hub"
      title="Orders, repairs, wishlist, profile, and AI recommendations"
      description="A single workspace for purchase history, payments, saved addresses, repair requests, personalized recommendations, and image search."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, body }) => (
          <div key={label} className="rounded-lg border border-[var(--border-faint)] bg-white p-5">
            <Icon className="size-5 text-[var(--heat-100)]" />
            <p className="mt-4 text-label-medium">{label}</p>
            <p className="mt-1 text-body-small text-[var(--black-alpha-56)]">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="AI image upload result">
          <div className="rounded-lg border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)] p-6">
            <ImageUp className="size-8 text-[var(--heat-100)]" />
            <pre className="mt-4 overflow-auto rounded-md bg-[var(--accent-black)] p-4 text-sm text-white">{JSON.stringify(aiPrediction, null, 2)}</pre>
          </div>
        </Panel>
        <Panel title="Repair request triage">
          <div className="rounded-lg border border-[var(--border-faint)] p-5">
            <pre className="overflow-auto rounded-md bg-[var(--accent-black)] p-4 text-sm text-white">{JSON.stringify(repairPrediction, null, 2)}</pre>
            <Link to="/repair" className="button button-primary mt-4 inline-flex h-11 items-center rounded-md px-5 text-label-medium">
              Book repair
            </Link>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
