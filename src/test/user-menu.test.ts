import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import UserMenu from "@/components/UserMenu";

describe("UserMenu & Minimalist Header Layout", () => {
  it("exports UserMenu component as default", () => {
    expect(UserMenu).toBeDefined();
    expect(typeof UserMenu).toBe("function");
  });

  it("ensures DevTools, Clear Feed, and Reset Profile are scoped to admin in UserMenu", () => {
    const userMenuPath = path.resolve(__dirname, "../components/UserMenu.tsx");
    const content = fs.readFileSync(userMenuPath, "utf-8");

    // Must have isAdmin check before rendering Admin Controls
    expect(content).toContain("{isAdmin && (");
    expect(content).toContain("Admin Controls");
    expect(content).toContain("DevTools");
    expect(content).toContain("Clear Feed");
    expect(content).toContain("Reset Profile & Memory");
    expect(content).toContain("Sign Out");
  });

  it("ensures desktop header in page.tsx is minimalist and delegates controls to UserMenu", () => {
    const pagePath = path.resolve(__dirname, "../app/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    // Header should import and use UserMenu
    expect(content).toContain("<UserMenu");

    // Desktop header must not have standalone loose buttons for devtools or clear feed
    const desktopControlsSection = content.split("{/* Desktop Global Controls */}")[1]?.split("{/* Mobile Header Quick Actions */}")[0];
    expect(desktopControlsSection).toBeDefined();
    expect(desktopControlsSection).not.toContain("Clear Feed");
    expect(desktopControlsSection).not.toContain("Reset Profile");
    expect(desktopControlsSection).not.toContain("Terminal");
    expect(desktopControlsSection).toContain("<UserMenu");
    expect(desktopControlsSection).toContain("Refresh News");
  });

  it("ensures mobile bottom nav does not contain DevTools", () => {
    const pagePath = path.resolve(__dirname, "../app/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    const bottomNavSection = content.split("{/* Mobile Fixed Bottom Navigation Bar */}")[1]?.split("</nav>")[0];
    expect(bottomNavSection).toBeDefined();
    expect(bottomNavSection).toContain("Feed");
    expect(bottomNavSection).toContain("Dialogue");
    expect(bottomNavSection).toContain("Interests");
    expect(bottomNavSection).not.toContain("DevTools");
  });

  it("ensures UserMenu supports viewingUser perspective and Exit View Mode button", () => {
    const userMenuPath = path.resolve(__dirname, "../components/UserMenu.tsx");
    const content = fs.readFileSync(userMenuPath, "utf-8");

    expect(content).toContain("viewingUser?: AppUser | null;");
    expect(content).toContain("onExitViewMode?: () => void;");
    expect(content).toContain("Exit View Mode");
    expect(content).toContain("Viewing");
  });

  it("ensures DevToolsPanel in page.tsx is strictly guarded with isAdmin && !viewingAsUser", () => {
    const pagePath = path.resolve(__dirname, "../app/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");

    expect(content).toContain("{isAdmin && !viewingAsUser && (");
    expect(content).toContain("<DevToolsPanel");
  });
});

