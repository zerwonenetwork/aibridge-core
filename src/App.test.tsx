import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./pages/Index", () => ({
  default: () => <div>Landing Page</div>,
}));

vi.mock("./pages/Docs", () => ({
  default: () => <div>Docs Page</div>,
}));

vi.mock("./pages/Dashboard", () => ({
  default: () => <div>Local Dashboard</div>,
}));

vi.mock("./pages/NotFound", () => ({
  default: () => <div>Not Found</div>,
}));

describe("App routing", () => {
  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", "/");
  });

  it("renders the local dashboard at /dashboard", async () => {
    window.history.pushState({}, "", "/dashboard");
    render(<App />);
    expect(await screen.findByText("Local Dashboard")).toBeInTheDocument();
  });

  it("renders the landing page at /", async () => {
    render(<App />);
    expect(await screen.findByText("Landing Page")).toBeInTheDocument();
  });
});
