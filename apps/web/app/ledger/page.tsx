import React from "react";
import { PageHeader } from "../components/ui";
import { JournalLedgerView } from "../components/JournalLedgerView";

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="General Ledger & Journal Entries"
        description="Immutable, double-entry balanced journal entries, line-item ledger details, and audit-compliant reversals."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "General Ledger" },
        ]}
      />
      <JournalLedgerView />
    </div>
  );
}
