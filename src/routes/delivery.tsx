import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, MetricCard, Panel } from "@/components/DashboardShell";
import { deliveryEvents } from "@/lib/marketplace";
import { IndianRupee, MapPinned, Navigation, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/delivery")({
  head: () => ({ meta: [{ title: "Delivery partner panel - LAPKART AI" }] }),
  component: DeliveryPage,
});

function DeliveryPage() {
  return (
    <DashboardShell
      eyebrow="delivery partner panel"
      title="Live routes, assigned orders, earnings, and proof uploads"
      description="Delivery partners can see route queues, pickup scans, hub events, customer ETA, earnings, and delivery history."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={PackageCheck} label="Assigned orders" value="18" trend="today" />
        <MetricCard icon={Navigation} label="Route efficiency" value="94%" trend="+8%" />
        <MetricCard icon={IndianRupee} label="Earnings" value="Rs. 2,840" trend="+12%" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Panel title="Tracking timeline">
          <div className="space-y-4">
            {deliveryEvents.map((event, index) => (
              <div key={event.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="grid size-8 place-items-center rounded-full bg-[var(--heat-100)] text-sm text-white">{index + 1}</span>
                  {index < deliveryEvents.length - 1 && <span className="h-10 w-px bg-[var(--border-muted)]" />}
                </div>
                <div>
                  <p className="text-label-small">{event.label}</p>
                  <p className="text-body-small text-[var(--black-alpha-56)]">{event.location}</p>
                  <p className="text-mono-x-small uppercase tracking-wider text-[var(--heat-100)]">{event.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Map and route optimization">
          <div className="grid min-h-72 place-items-center rounded-lg border border-[var(--border-faint)] bg-[var(--background-lighter)]">
            <div className="text-center">
              <MapPinned className="mx-auto size-10 text-[var(--heat-100)]" />
              <p className="mt-3 text-label-medium">Maps provider hook ready</p>
              <p className="mt-1 max-w-sm text-body-small text-[var(--black-alpha-56)]">Connect Google Maps or Mapbox for GPS, route optimization, ETA, and proof-of-delivery geotags.</p>
            </div>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
