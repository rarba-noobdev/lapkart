import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { FulfillmentQueue } from "./admin";

export const Route = createFileRoute("/_authenticated/admin/fulfillment")({
  head: () => ({
    meta: [
      { title: "Fulfillment operations - LapKart" },
      {
        name: "description",
        content: "Manage Shiprocket shipments, AWB assignment, pickups, labels, and tracking.",
      },
    ],
  }),
  component: AdminFulfillmentPage,
});

function AdminFulfillmentPage() {
  const navigate = useNavigate();
  const { role, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && role && role !== "admin") {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [authLoading, navigate, role]);

  if (authLoading || role === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <Loader2 className="size-5 animate-spin text-[var(--heat-100)]" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background-base)]">
        <p className="text-body-medium text-[var(--black-alpha-56)]">
          Redirecting to your account.
        </p>
      </div>
    );
  }

  return (
    <DashboardShell
      eyebrow="admin operations"
      title="Fulfillment operations"
      description="Dedicated shipment queue for Shiprocket order creation, AWB assignment, pickups, labels, and tracking."
    >
      <AdminOperationsTabs />
      <FulfillmentQueue />
    </DashboardShell>
  );
}

function AdminOperationsTabs() {
  return (
    <div className="sticky top-0 z-20 -mx-4 mt-6 border-y border-[var(--border-faint)] bg-[var(--background-base)]/95 px-4 py-3 backdrop-blur">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          to="/admin"
          className="inline-flex h-10 shrink-0 items-center rounded-md border border-[var(--border-muted)] bg-white px-4 text-label-small text-foreground transition-colors hover:border-[var(--heat-100)] hover:text-[var(--heat-100)]"
        >
          Dashboard
        </Link>
        <span className="inline-flex h-10 shrink-0 items-center rounded-md border border-[var(--heat-100)] bg-[var(--heat-8)] px-4 text-label-small text-[var(--heat-100)]">
          Fulfillment
        </span>
      </div>
    </div>
  );
}
