import { describe, it, expect, vi, beforeEach } from "vitest";
import { postgresStore } from "@/core/storage/postgres-store";
import { SupportCategory, SupportTicketPayload } from "@/core/types/contracts";

describe("Support System Tests", () => {
  it("stores and retrieves support tickets in PostgresStore", async () => {
    const testTicket = {
      name: "Alice Explorer",
      email: "alice@example.com",
      category: "bug_report" as SupportCategory,
      subject: "Feed display glitch",
      message: "The cards overlap on high DPI displays.",
      metadata: {
        userId: "usr_alice123",
        tier: "pro",
        screenWidth: 2560,
        screenHeight: 1440,
      },
    };

    const saved = await postgresStore.saveSupportTicket(testTicket);

    expect(saved).toBeDefined();
    expect(saved.id).toBeDefined();
    expect(saved.name).toBe("Alice Explorer");
    expect(saved.email).toBe("alice@example.com");
    expect(saved.category).toBe("bug_report");
    expect(saved.subject).toBe("Feed display glitch");
    expect(saved.status).toBe("open");
    expect(saved.metadata.tier).toBe("pro");

    const retrieved = await postgresStore.getSupportTickets(10);
    expect(retrieved.length).toBeGreaterThan(0);
    const matched = retrieved.find((t) => t.id === saved.id);
    expect(matched).toBeDefined();
    expect(matched?.message).toBe("The cards overlap on high DPI displays.");
  });
});
