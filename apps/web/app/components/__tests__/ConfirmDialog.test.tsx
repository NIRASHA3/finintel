import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmDialog } from "../ui/ConfirmDialog";

describe("ConfirmDialog Component", () => {
  it("renders destructive confirmation styling and labels", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete Webhook"
        message="Are you sure you want to delete this webhook?"
        confirmLabel="Delete Forever"
        isDestructive={true}
      />
    );

    expect(screen.getByText("Delete Webhook")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete this webhook?")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Delete Forever" });
    expect(confirmBtn).toHaveClass("bg-[#BA1A1A]");
  });

  it("calls onConfirm and onClose handlers", () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Lock Period"
        message="Lock this fiscal period?"
        confirmLabel="Confirm Lock"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm Lock" }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("disables buttons and shows spinner when isLoading is true", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Batch Posting"
        message="Posting..."
        isLoading={true}
      />
    );

    const confirmBtn = screen.getByRole("button", { name: /Processing/ });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
