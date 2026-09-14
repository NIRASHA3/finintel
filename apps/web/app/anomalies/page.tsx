import React from "react";
import { PageHeader } from "../components/ui";
import { AnomalyReviewView } from "../components/AnomalyReviewView";

export default function AnomaliesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligence Anomaly Queue"
        description="Automated AI rule inspection for detecting high-value outliers, duplicate references, and suspicious journal mutations."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Anomalies" },
        ]}
      />
      <AnomalyReviewView />
    </div>
  );
}
