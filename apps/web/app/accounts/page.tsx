import React from "react";
import { PageHeader } from "../components/ui";
import { ChartOfAccountsView } from "../components/ChartOfAccountsView";

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chart of Accounts (COA)"
        description="Structured classifications and active general ledger codes across assets, liabilities, equity, revenue, and expenses."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Chart of Accounts" },
        ]}
      />
      <ChartOfAccountsView />
    </div>
  );
}
