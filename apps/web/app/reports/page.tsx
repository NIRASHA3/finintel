import React from "react";
import { PageHeader } from "../components/ui";
import { FinancialReportsView } from "../components/FinancialReportsView";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Statement Reports"
        description="GAAP-compliant Balance Sheet, Income Statement (Profit & Loss), and Trial Balance verification statements."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Financial Reports" },
        ]}
      />
      <FinancialReportsView />
    </div>
  );
}
