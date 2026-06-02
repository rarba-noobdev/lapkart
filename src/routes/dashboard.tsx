import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel } from "@/components/DashboardShell";
import { CreditCard, MapPin, PackageCheck, ShoppingBag, UserRound } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Customer dashboard - LapKart" }] }),
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const tiles = [
    { icon: PackageCheck, label: "Orders", body: "2 active / 12 delivered" },
    { icon: MapPin, label: "Addresses", body: "3 saved delivery addresses" },
    { icon: UserRound, label: "Profile", body: "Account and preferences" },
    { icon: CreditCard, label: "Payments", body: "Razorpay checkout history" },
  ];

  return (
    <DashboardShell
      eyebrow="customer hub"
      title="Orders, addresses, payments, and profile"
      description="A single workspace for purchase history, payments, saved addresses, and account preferences."
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
        <Panel title="Recent order activity">
          <div className="space-y-3">
            {["Order LPK-1024 packed", "Order LPK-1018 delivered", "Delivery estimate updated"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-md border border-[var(--border-faint)] p-3">
                <PackageCheck className="size-4 text-[var(--heat-100)]" />
                <span className="text-label-small">{item}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Shopping shortcuts">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Continue shopping", ShoppingBag],
              ["Payment methods", CreditCard],
              ["Track orders", PackageCheck],
              ["Delivery addresses", MapPin],
            ].map(([label, Icon]) => (
              <div key={label as string} className="rounded-md border border-[var(--border-faint)] bg-[var(--background-lighter)] p-4">
                <Icon className="size-4 text-[var(--heat-100)]" />
                <p className="mt-3 text-label-small">{label as string}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
