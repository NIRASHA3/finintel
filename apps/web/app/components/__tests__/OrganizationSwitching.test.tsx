import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OrganizationProvider, useOrganization } from "../../../lib/context/OrganizationContext";
import * as apiClient from "../../../lib/api-client";

vi.mock("../../../lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/api-client")>("../../../lib/api-client");
  return {
    ...actual,
    fetchCurrentUser: vi.fn().mockResolvedValue({
      id: "usr-123",
      email: "finance-lead@finintel.io",
      fullName: "Jane Lead",
      createdAt: "2026-01-01T00:00:00Z",
    }),
    fetchUserOrganizations: vi.fn().mockResolvedValue([
      { id: "org-1", name: "Acme Global", baseCurrency: "USD", fiscalYearStartMonth: 1, role: "OWNER", createdAt: "2026-01-01" },
      { id: "org-2", name: "Euro Retail SARL", baseCurrency: "EUR", fiscalYearStartMonth: 4, role: "ACCOUNTANT", createdAt: "2026-02-01" },
    ]),
    checkSystemHealth: vi.fn().mockResolvedValue("healthy"),
  };
});

function OrgTestConsumer() {
  const { activeOrg, organizations, switchOrganization, healthStatus } = useOrganization();
  return (
    <div>
      <span data-testid="active-name">{activeOrg?.name}</span>
      <span data-testid="active-curr">{activeOrg?.baseCurrency}</span>
      <span data-testid="health-status">{healthStatus}</span>
      <select
        data-testid="org-select"
        value={activeOrg?.id || ""}
        onChange={(e) => switchOrganization(e.target.value)}
      >
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

describe("Organization Context and Switching", () => {
  it("loads organizations and sets the default active tenant", async () => {
    render(
      <OrganizationProvider>
        <OrgTestConsumer />
      </OrganizationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-name")).toHaveTextContent("Acme Global");
      expect(screen.getByTestId("active-curr")).toHaveTextContent("USD");
    });
  });

  it("switches the active tenant and updates base currency", async () => {
    render(
      <OrganizationProvider>
        <OrgTestConsumer />
      </OrganizationProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("active-name")).toHaveTextContent("Acme Global");
    });

    fireEvent.change(screen.getByTestId("org-select"), { target: { value: "org-2" } });

    await waitFor(() => {
      expect(screen.getByTestId("active-name")).toHaveTextContent("Euro Retail SARL");
      expect(screen.getByTestId("active-curr")).toHaveTextContent("EUR");
    });
  });
});
