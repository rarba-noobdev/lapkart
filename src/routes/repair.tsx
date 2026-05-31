import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, Panel } from "@/components/DashboardShell";
import { repairPrediction } from "@/lib/marketplace";
import { Camera, Cpu, Wrench } from "lucide-react";

export const Route = createFileRoute("/repair")({
  head: () => ({ meta: [{ title: "Repair services - LAPKART AI" }] }),
  component: RepairPage,
});

function RepairPage() {
  return (
    <DashboardShell
      eyebrow="repair services"
      title="AI repair triage and technician assignment"
      description="Customers upload laptop and issue images. The AI predicts damage, severity, estimated cost, spare parts, and routing to a technician."
    >
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Upload issue images">
          <div className="grid gap-3">
            {["Laptop image", "Issue close-up", "Invoice or serial label"].map((label) => (
              <div key={label} className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border-muted)] bg-[var(--background-lighter)]">
                <Camera className="mr-2 size-5 text-[var(--heat-100)]" />
                <span className="text-label-small">{label}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="AI diagnosis">
          <div className="grid gap-4 md:grid-cols-2">
            <pre className="overflow-auto rounded-md bg-[var(--accent-black)] p-4 text-sm text-white">{JSON.stringify(repairPrediction, null, 2)}</pre>
            <div className="rounded-md border border-[var(--border-faint)] p-4">
              <Wrench className="size-5 text-[var(--heat-100)]" />
              <p className="mt-3 text-label-medium">Technician queue</p>
              <p className="mt-2 text-body-small text-[var(--black-alpha-56)]">Assign certified screen technician, reserve compatible display, collect payment hold, and notify customer by SMS/email/push.</p>
              <div className="mt-4 flex items-center gap-2 text-mono-x-small uppercase tracking-wider text-[var(--accent-forest)]">
                <Cpu className="size-3" /> parts compatibility checked
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </DashboardShell>
  );
}
