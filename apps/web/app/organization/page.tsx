import React from "react";
import { PageHeader } from "../components/ui";
import { OrganizationDetailsView } from "../components/OrganizationDetailsView";

export default function OrganizationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Configuration & Members"
        description="Active multi-tenant workspace details, base currency definitions, calendar start months, and membership administration."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Tenant Details" },
        ]}
      />
      <OrganizationDetailsView />
    </div>
  );
}
