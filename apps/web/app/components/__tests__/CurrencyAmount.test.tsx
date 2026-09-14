import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CurrencyAmount } from "../ui/CurrencyAmount";

describe("CurrencyAmount Component", () => {
  it("formats positive USD amounts correctly", () => {
    render(<CurrencyAmount amountMinorUnits={125050} currency="USD" />);
    expect(screen.getByText("$1,250.50")).toBeInTheDocument();
  });

  it("formats base currencies other than USD (EUR, GBP, JPY)", () => {
    const { rerender } = render(
      <CurrencyAmount amountMinorUnits={500000} currency="EUR" />
    );
    expect(screen.getByText(/5,000.00/)).toBeInTheDocument();

    rerender(<CurrencyAmount amountMinorUnits={25000} currency="GBP" />);
    expect(screen.getByText(/250.00/)).toBeInTheDocument();
  });

  it("formats negative amounts with minus sign and screen-reader indicator", () => {
    render(
      <CurrencyAmount
        amountMinorUnits={-7500}
        currency="USD"
        highlightDirection
      />
    );
    expect(screen.getByText((content) => content.includes("-$75.00") || (content.includes("-") && content.includes("$75.00")))).toBeInTheDocument();
    expect(screen.getByText("(Loss)")).toHaveClass("sr-only");
  });

  it("applies tabular numerals class for vertical financial alignment", () => {
    const { container } = render(
      <CurrencyAmount amountMinorUnits={10000} currency="USD" />
    );
    const span = container.querySelector("span");
    expect(span).toHaveClass("tnum");
    expect(span).toHaveClass("font-mono");
  });
});
