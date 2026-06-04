import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/PolicyPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy - LapKart" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy policy"
      description="LapKart stores only the information needed to run account, checkout, delivery, support, and security workflows."
      sections={[
        {
          title: "Data we collect",
          body: "We collect account details, contact information, delivery addresses, map-selected delivery coordinates, order details, payment references, and support workflow records.",
        },
        {
          title: "How data is used",
          body: "Data is used to authenticate users, verify payments, estimate delivery, create shipments, provide tracking, process returns/refunds, prevent abuse, and support customers.",
        },
        {
          title: "Third-party processors",
          body: "Payment, logistics, and map-related data may be shared with Razorpay, Shiprocket, Ola Maps, and Supabase only as needed for the requested service.",
        },
      ]}
    />
  );
}
