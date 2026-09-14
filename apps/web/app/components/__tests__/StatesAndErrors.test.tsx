import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LoadingSkeleton } from "../ui/LoadingSkeleton";
import { EmptyState } from "../ui/EmptyState";
import { AlertBanner } from "../ui/AlertBanner";

describe("Design System Feedback States", () => {
  describe("LoadingSkeleton", () => {
    it("renders with aria-busy and status role for accessibility", () => {
      render(<LoadingSkeleton variant="table" />);
      const skeleton = screen.getByRole("status");
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("EmptyState", () => {
    it("renders title, description and triggers action button", () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          title="No Data Available"
          description="Please add a record to populate this table."
          actionLabel="Create New"
          onAction={handleAction}
        />
      );

      expect(screen.getByText("No Data Available")).toBeInTheDocument();
      expect(screen.getByText("Please add a record to populate this table.")).toBeInTheDocument();
      const btn = screen.getByRole("button", { name: "Create New" });
      fireEvent.click(btn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });

  describe("AlertBanner", () => {
    it("renders role alert and executes retry callback", () => {
      const handleRetry = vi.fn();
      render(
        <AlertBanner
          type="error"
          title="API Network Failure"
          message="Failed to connect to backend server."
          onRetry={handleRetry}
        />
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(screen.getByText("API Network Failure")).toBeInTheDocument();
      const retryBtn = screen.getByRole("button", { name: "Retry operation" });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });
});
