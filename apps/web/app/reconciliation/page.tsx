import React from "react";
import { PageHeader } from "../components/ui";
import { ReconciliationView } from "../components/ReconciliationView";

export default function ReconciliationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Statement Reconciliation"
        description="Automated matching of imported bank statement feeds against confirmed general ledger postings."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Bank Reconciliation" },
        ]}
        isPrototype
        prototypeLabel="PROTOTYPE"
      />
      <ReconciliationView />
    </div>
  );
}
