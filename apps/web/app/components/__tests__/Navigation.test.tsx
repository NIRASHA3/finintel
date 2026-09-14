import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SidebarNavigation } from "../ui/SidebarNavigation";
import { OrganizationProvider } from "../../../lib/context/OrganizationContext";
import { MobileNavigation } from "../ui/MobileNavigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ledger",
}));

describe("Navigation Shell Components", () => {
  it("renders all five canonical grouped navigation categories", () => {
    render(<SidebarNavigation />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Accounting")).toBeInTheDocument();
    expect(screen.getByText("Reporting")).toBeInTheDocument();
    expect(screen.getByText("Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Administration")).toBeInTheDocument();

    // Check specific navigation items
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("General Ledger")).toBeInTheDocument();
    expect(screen.getByText("Chart of Accounts")).toBeInTheDocument();
    expect(screen.getByText("Financial Reports")).toBeInTheDocument();
    expect(screen.getByText("Anomalies")).toBeInTheDocument();
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
  });

  it("marks the active link with aria-current='page'", () => {
    render(<SidebarNavigation />);
    const activeLink = screen.getByRole("link", { name: /General Ledger/i });
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("renders mobile drawer when isOpen is true", () => {
    render(
      <OrganizationProvider>
        <MobileNavigation isOpen={true} onClose={() => {}} />
      </OrganizationProvider>
    );

    const drawer = screen.getByRole("dialog", { name: "Mobile Navigation Menu" });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText("FinIntel")).toBeInTheDocument();
  });
});
