import React from "react";
import { PageHeader } from "../components/ui";
import { WebhooksView } from "../components/WebhooksView";

export default function WebhooksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook Notification Engine"
        description="Outbound event subscription management, delivery status monitoring, and HMAC-SHA256 signature verification."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Webhooks" },
        ]}
        isPrototype
        prototypeLabel="PROTOTYPE"
      />
      <WebhooksView />
    </div>
  );
}
