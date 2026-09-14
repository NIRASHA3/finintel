import React from "react";
import { PageHeader } from "../components/ui";
import { StagedTransactionsView } from "../components/StagedTransactionsView";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaction Import & Review Queue"
        description="Review staged bank statements, automated deduplication hashes, account suggestions, and commit batch postings."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Transactions" },
        ]}
      />
      <StagedTransactionsView />
    </div>
  );
}
