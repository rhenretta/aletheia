import { describe, it, expect } from "vitest";
import { postgresStore } from "../core/storage/postgres-store";
import { NextRequest } from "next/server";
import { GET } from "../app/api/session/route";

describe("User Segmentation & View-As Isolation", () => {
  const adminUserId = "usr_rhenretta_gmail_com";
  const newUserId = `usr_clean_new_${Date.now()}`;
  const newEmail = `clean_user_${Date.now()}@example.com`;

  it("ensures a new user starts with 0 topics and 0 messages in store", async () => {
    // 1. Create a brand new user with no interactions
    const user = await postgresStore.getOrCreateUser({
      id: newUserId,
      email: newEmail,
      name: "Clean New User",
      role: "user",
    });

    expect(user).toBeDefined();
    expect(user.id).toBe(newUserId);

    // 2. Query node and chat for this new user
    const node = await postgresStore.getUnifiedTopicNode(newUserId);
    const chat = await postgresStore.getChatSession(newUserId);

    expect(Object.keys(node.topics || {}).length).toBe(0);
    expect(chat?.messages || []).toHaveLength(0);
  });

  it("keeps admin topics and messages strictly isolated from the new user", async () => {
    const adminNode = await postgresStore.getUnifiedTopicNode(adminUserId);
    const newNode = await postgresStore.getUnifiedTopicNode(newUserId);

    // Admin should retain topics if populated, while new user is clean
    expect(Object.keys(newNode.topics || {}).length).toBe(0);
    expect(newNode.user_id).toBe(newUserId);
    expect(newNode.user_id).not.toBe(adminUserId);
  });

  it("handles viewAs parameter safely and rejects unauthorized access with 403", async () => {
    // A request without admin credentials attempting to viewAs another user
    const unauthReq = new NextRequest(`http://localhost:3000/api/session?viewAs=${newUserId}`, {
      headers: {
        "x-view-as-user": newUserId,
      },
    });

    const origEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";
      const res = await GET(unauthReq);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Unauthorized");
    } finally {
      (process.env as any).NODE_ENV = origEnv;
    }
  });

  it("correctly returns target user identity in read-only view mode without falling back to session.user", async () => {
    // Admin authorized request to view new user
    const adminReq = new NextRequest(`http://localhost:3000/api/session?viewAs=${newUserId}`, {
      headers: {
        "x-view-as-user": newUserId,
        "x-admin-key": process.env.ADMIN_SECRET_KEY || process.env.NEXTAUTH_SECRET || "aletheia-dev-secret-key-32chars-minimum-safe",
      },
    });

    const res = await GET(adminReq);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.is_viewing_as).toBe(true);
    expect(json.user_id).toBe(newUserId);
    expect(json.user.id).toBe(newUserId);
    expect(json.user.email).toBe(newEmail);
    expect(json.user.name).toBe("Clean New User");
    expect(json.messages).toHaveLength(0);
    expect(Object.keys(json.unified_topic_node?.topics || {})).toHaveLength(0);
  });
});
