import React from "react";
import { PageHeader } from "./components/ui";
import { DashboardOverviewView } from "./components/DashboardOverviewView";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Financial Dashboard"
        description="Comprehensive liquidity overview, real-time cash runway, operating burn rate, and financial health metrics."
      />
      <DashboardOverviewView />
    </div>
  );
}
