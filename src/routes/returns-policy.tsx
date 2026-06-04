import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/PolicyPage";

export const Route = createFileRoute("/returns-policy")({
  head: () => ({ meta: [{ title: "Return Policy - LapKart" }] }),
  component: ReturnsPolicyPage,
});

function ReturnsPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Returns"
      title="Return policy"
      description="Eligible delivered orders can be requested for return from the order detail page within the return window."
      sections={[
        {
          title: "Return window",
          body: "Returns are available for eligible delivered orders for 7 days from delivery. Returned products must match the shipped item and be in the condition described in the request.",
        },
        {
          title: "Return review",
          body: "Return requests are reviewed by an admin. Approval, rejection, reverse pickup, warehouse receipt, and refund status are tracked against the order.",
        },
        {
          title: "Non-returnable cases",
          body: "Products damaged by misuse, missing serial labels, mismatched parts, or items outside the return window may be rejected after review.",
        },
      ]}
    />
  );
}
