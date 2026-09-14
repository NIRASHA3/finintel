import React from "react";
import { PageHeader } from "../components/ui";
import { AuditTrailView } from "../components/AuditTrailView";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Audit Trail"
        description="Immutable, cryptographically verifiable log of all administrative actions, journal commits, and security events."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audit Trail" },
        ]}
      />
      <AuditTrailView />
    </div>
  );
}
