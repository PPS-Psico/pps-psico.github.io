import "@testing-library/jest-dom";
import { describe, it, expect } from "@jest/globals";
import React from "react";
import { render, screen } from "@testing-library/react";
import ProgressBar from "../ProgressBar";

describe("ProgressBar", () => {
  it("renders the label and values correctly", () => {
    render(<ProgressBar value={50} max={100} label="Test Progress" unit="%" isComplete={false} />);

    // Check if the label is rendered
    expect(screen.getByText("Test Progress")).toBeInTheDocument();

    // Check if the current value and max value are displayed
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("/ 100%")).toBeInTheDocument();
  });

  it("sets the correct aria attributes for accessibility", () => {
    render(<ProgressBar value={75} max={150} label="Accessibility Test" isComplete={false} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "75");
    expect(progressBar).toHaveAttribute("aria-valuemin", "0");
    expect(progressBar).toHaveAttribute("aria-valuemax", "150");
  });

  it("calculates and applies the correct width percentage", () => {
    render(<ProgressBar value={25} max={100} label="Width Test" isComplete={false} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveStyle("width: 25%");
  });

  it("caps the width at 100% if value exceeds max", () => {
    render(<ProgressBar value={120} max={100} label="Capped Width Test" isComplete={true} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveStyle("width: 100%");
  });

  it("shows the completion message when isComplete is true", () => {
    render(<ProgressBar value={100} max={100} label="Completion Test" isComplete={true} />);

    expect(screen.getByText("Objetivo cumplido")).toBeInTheDocument();
  });

  it("does not show the completion message when isComplete is false", () => {
    render(<ProgressBar value={99} max={100} label="Incomplete Test" isComplete={false} />);

    expect(screen.queryByText("¡Objetivo de horas cumplido!")).not.toBeInTheDocument();
  });
});
