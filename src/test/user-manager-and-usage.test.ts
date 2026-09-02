import { describe, it, expect, beforeEach } from "vitest";
import { postgresStore } from "../core/storage/postgres-store";
import { isReadOnlyRequest, readOnlyForbiddenResponse } from "../core/auth/read-only-guard";
import { NextRequest } from "next/server";

describe("User Levels, User Manager & Usage Tracking System", () => {
  const testUserId = `usr_test_user_${Date.now()}`;
  const testEmail = `tester_${Date.now()}@example.com`;

  describe("1. User Levels & Role Management", () => {
    it("creates a new user with standard 'user' role by default", async () => {
      const user = await postgresStore.getOrCreateUser({
        id: testUserId,
        email: testEmail,
        name: "Test User",
        role: "user",
      });

      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);
      expect(user.email).toBe(testEmail);
      expect(user.role).toBe("user");
      expect(user.status).toBe("active");
    });

    it("retrieves the user by ID and by email", async () => {
      const userById = await postgresStore.getUser(testUserId);
      expect(userById).toBeDefined();
      expect(userById?.id).toBe(testUserId);

      const userByEmail = await postgresStore.getUserByEmail(testEmail);
      expect(userByEmail).toBeDefined();
      expect(userByEmail?.id).toBe(testUserId);
    });

    it("promotes a user to 'admin' level and demotes back to 'user'", async () => {
      // Promote to admin
      const promoted = await postgresStore.updateUserRole(testUserId, "admin");
      expect(promoted.role).toBe("admin");

      const refreshed = await postgresStore.getUser(testUserId);
      expect(refreshed?.role).toBe("admin");

      // Demote back to user
      const demoted = await postgresStore.updateUserRole(testUserId, "user");
      expect(demoted.role).toBe("user");

      const finalCheck = await postgresStore.getUser(testUserId);
      expect(finalCheck?.role).toBe("user");
    });

    it("lists all registered users including seeded users", async () => {
      const allUsers = await postgresStore.getAllUsers();
      expect(allUsers.length).toBeGreaterThanOrEqual(3);
      
      const hasAdmin = allUsers.some((u) => u.role === "admin");
      expect(hasAdmin).toBe(true);

      const hasUser = allUsers.some((u) => u.role === "user");
      expect(hasUser).toBe(true);
    });
  });

  describe("2. Usage Tracking Per User", () => {
    it("initializes zero usage baseline for a new user", async () => {
      const usage = await postgresStore.getUserUsage(testUserId);
      expect(usage).toBeDefined();
      expect(usage.user_id).toBe(testUserId);
      expect(usage.total_chat_messages).toBe(0);
      expect(usage.total_pipeline_runs).toBe(0);
      expect(usage.total_tokens_used).toBe(0);
      expect(usage.total_dwell_time_ms).toBe(0);
    });

    it("accumulates chat message and token consumption", async () => {
      await postgresStore.recordUsage(testUserId, {
        chatMessages: 1,
        tokensUsed: 250,
        eventName: "chat",
        detail: "User asked about autonomous agents",
      });

      const updated = await postgresStore.getUserUsage(testUserId);
      expect(updated.total_chat_messages).toBe(1);
      expect(updated.total_tokens_used).toBe(250);
      expect(updated.recent_events.length).toBe(1);
      expect(updated.recent_events[0].type).toBe("chat");
      expect(updated.recent_events[0].detail).toContain("autonomous agents");
    });

    it("accumulates pipeline runs and passive reading dwell time", async () => {
      await postgresStore.recordUsage(testUserId, {
        pipelineRuns: 2,
        dwellTimeMs: 45000,
        eventName: "pipeline",
        detail: "Curated 8 stories",
      });

      const updated = await postgresStore.getUserUsage(testUserId);
      expect(updated.total_chat_messages).toBe(1);
      expect(updated.total_pipeline_runs).toBe(2);
      expect(updated.total_tokens_used).toBe(250);
      expect(updated.total_dwell_time_ms).toBe(45000);
      expect(updated.recent_events.length).toBe(2);
    });

    it("retrieves usage for all users in a single map", async () => {
      const allUsage = await postgresStore.getAllUserUsage();
      expect(allUsage).toBeDefined();
      expect(allUsage[testUserId]).toBeDefined();
      expect(allUsage[testUserId].total_pipeline_runs).toBe(2);
    });
  });

  describe("3. Read-Only Impersonation Guard", () => {
    it("detects read-only impersonation via x-view-as-user header", () => {
      const req = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "x-view-as-user": "usr_alex" },
      });
      expect(isReadOnlyRequest(req)).toBe(true);
    });

    it("detects read-only impersonation via x-read-only-mode header", () => {
      const req = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "x-read-only-mode": "true" },
      });
      expect(isReadOnlyRequest(req)).toBe(true);
    });

    it("detects read-only impersonation via query parameter ?viewAs=", () => {
      const req = new NextRequest("http://localhost:3000/api/chat?viewAs=usr_alex", {
        method: "POST",
      });
      expect(isReadOnlyRequest(req)).toBe(true);
    });

    it("returns false for standard non-impersonating requests", () => {
      const req = new NextRequest("http://localhost:3000/api/chat", {
        method: "POST",
      });
      expect(isReadOnlyRequest(req)).toBe(false);
    });

    it("generates a 403 Forbidden response with clear error messaging", async () => {
      const response = readOnlyForbiddenResponse("Chat interactions");
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.is_read_only).toBe(true);
      expect(json.error).toContain("Read-only mode active: Chat interactions are not permitted");
    });
  });
});
