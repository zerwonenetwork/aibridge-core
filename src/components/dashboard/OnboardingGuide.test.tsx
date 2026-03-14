import { fireEvent, render, screen } from "@testing-library/react";
import type { HTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingGuide } from "./OnboardingGuide";
import { LocalBridgeClientError } from "@/lib/aibridge/local/client";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock("@/components/setup/SetupWizard", () => ({
  SetupWizard: () => <div>Embedded Local Setup Wizard</div>,
}));

describe("OnboardingGuide", () => {
  it("shows the local guided setup flow when no bridge is found", () => {
    render(
      <OnboardingGuide
        error={new LocalBridgeClientError("NO_BRIDGE_FOUND", "No bridge found.")}
        localSource="workspace"
        customRoot=""
        accessRole="admin"
        adminToken=""
        onSwitchToSample={vi.fn()}
        onOpenSettings={vi.fn()}
        onUseWorkspace={vi.fn()}
        onUseCustomWorkspace={vi.fn()}
        onRetry={vi.fn()}
        onLocalInitialized={vi.fn()}
      />,
    );

    expect(screen.getByText("No bridge found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use current workspace/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start guided setup/i }));
    expect(screen.getByText("Embedded Local Setup Wizard")).toBeInTheDocument();
  });

  it("keeps service-down onboarding as UI-first instructions", () => {
    const onRetry = vi.fn();
    render(
      <OnboardingGuide
        error={new LocalBridgeClientError("SERVICE_UNAVAILABLE", "Service unavailable.")}
        localSource="workspace"
        customRoot=""
        accessRole="admin"
        adminToken=""
        onSwitchToSample={vi.fn()}
        onOpenSettings={vi.fn()}
        onUseWorkspace={vi.fn()}
        onUseCustomWorkspace={vi.fn()}
        onRetry={onRetry}
        onLocalInitialized={vi.fn()}
      />,
    );

    expect(screen.getByText("Service not reachable")).toBeInTheDocument();
    expect(screen.queryByText("Embedded Local Setup Wizard")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry connection/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/aibridge serve/)).toBeInTheDocument();
  });
});
