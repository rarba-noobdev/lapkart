import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/PolicyPage";

export const Route = createFileRoute("/cancellation-refunds")({
  head: () => ({ meta: [{ title: "Cancellation and Refunds - LapKart" }] }),
  component: CancellationRefundsPage,
});

function CancellationRefundsPage() {
  return (
    <PolicyPage
      eyebrow="Cancellations and refunds"
      title="Cancellation and refund policy"
      description="Cancellation and refund status is handled from your order detail page and reviewed by the operations team."
      sections={[
        {
          title: "Cancellation eligibility",
          body: "Paid orders can be requested for cancellation before shipment movement begins. Once an AWB is assigned or the courier process has started, cancellation may not be available through self-service.",
        },
        {
          title: "Refund processing",
          body: "Approved cancellation or return refunds are processed against the original Razorpay payment. Refund timing depends on the payment provider and bank processing timelines.",
        },
        {
          title: "Partial refunds",
          body: "Where only part of an order is approved for return, the admin may issue a partial refund based on item value, condition, and applicable policy.",
        },
      ]}
    />
  );
}
