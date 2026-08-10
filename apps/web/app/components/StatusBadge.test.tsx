import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge Component", () => {
  it("renders correctly with status text", () => {
    render(<StatusBadge status="DEVELOPMENT" label="Active Scaffolding" />);
    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Active Scaffolding");
  });

  it("applies appropriate ARIA accessibility label", () => {
    render(<StatusBadge status="ONLINE" />);
    const badge = screen.getByRole("status", { name: "System status: ONLINE" });
    expect(badge).toBeInTheDocument();
  });
});
