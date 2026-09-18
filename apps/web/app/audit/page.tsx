import React from "react";
import { PageHeader } from "../components/ui";
import { AuditTrailView } from "../components/AuditTrailView";

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Audit Trail"
        description="Append-only history of administrative actions, journal activity, and recorded security events."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Audit Trail" },
        ]}
      />
      <AuditTrailView />
    </div>
  );
}
