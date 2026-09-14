import React from "react";
import { PageHeader } from "../components/ui";
import { FiscalPeriodsView } from "../components/FiscalPeriodsView";

export default function PeriodsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal Periods & Hard-Lock Controls"
        description="Accounting calendar periods, monthly close procedures, and permanent hard-locking to seal historical balances."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Fiscal Periods" },
        ]}
      />
      <FiscalPeriodsView />
    </div>
  );
}
