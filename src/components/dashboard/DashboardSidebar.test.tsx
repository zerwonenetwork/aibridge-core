import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DashboardSidebar } from "./DashboardSidebar";

vi.mock("@/assets/logo.png", () => ({
  default: "logo.png",
}));

function renderSidebar(children: ReactNode) {
  return render(<MemoryRouter>{children}</MemoryRouter>);
}

describe("DashboardSidebar", () => {
  it("renders core nav items for local dashboard", () => {
    renderSidebar(
      <DashboardSidebar
        activeView="overview"
        onViewChange={() => undefined}
        unreadCount={2}
      />,
    );

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });
});
