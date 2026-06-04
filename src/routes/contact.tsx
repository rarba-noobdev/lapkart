import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/PolicyPage";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact LapKart" }] }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <PolicyPage
      eyebrow="Contact"
      title="Contact and support"
      description="Use this page for order support, returns, delivery questions, and catalog compatibility help."
      sections={[
        {
          title: "Customer support",
          body: "Email support@lapkart.com with your order id, registered phone number, and a short description of the issue. Support is handled Monday to Saturday during business hours.",
        },
        {
          title: "Order issues",
          body: "For active orders, open your order detail page to view tracking, cancellation eligibility, return eligibility, refund status, and invoice information.",
        },
        {
          title: "Business information",
          body: "LapKart operates as an ecommerce storefront for laptop components and replacement hardware. Formal business address and statutory details should be updated here before live payment review.",
        },
      ]}
    />
  );
}
