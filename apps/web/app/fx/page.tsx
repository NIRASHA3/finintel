import React from "react";
import { PageHeader } from "../components/ui";
import { FxRevaluationView } from "../components/FxRevaluationView";

export default function FxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Multi-Currency & FX Revaluation"
        description="Foreign exchange rate maintenance and period-end unrealized gain/loss ledger revaluations."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "FX Rates & Revaluation" },
        ]}
        isPrototype
        prototypeLabel="PROTOTYPE"
      />
      <FxRevaluationView />
    </div>
  );
}
