import { describe, it, expect } from "vitest";
import {
  generateChannelId,
  hasChannelPermission,
  ROLE_PERMISSIONS,
  CHANNEL_PERMISSIONS,
} from "./channels.js";

describe("channels types", () => {
  describe("generateChannelId", () => {
    it("should generate a unique channel ID with achan_ prefix", () => {
      const id = generateChannelId();
      expect(id).toMatch(/^achan_[a-f0-9-]{36}$/);
    });

    it("should generate unique IDs on each call", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateChannelId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("ROLE_PERMISSIONS", () => {
    it("should define owner as having all permissions", () => {
      expect(ROLE_PERMISSIONS.owner).toBe("*");
    });

    it("should define admin permissions", () => {
      const adminPerms = ROLE_PERMISSIONS.admin;
      expect(Array.isArray(adminPerms)).toBe(true);
      expect(adminPerms).toContain("send_messages");
      expect(adminPerms).toContain("invite_agents");
      expect(adminPerms).toContain("kick_agents");
    });

    it("should define member permissions", () => {
      const memberPerms = ROLE_PERMISSIONS.member;
      expect(Array.isArray(memberPerms)).toBe(true);
      expect(memberPerms).toContain("send_messages");
      expect(memberPerms).toContain("create_threads");
      expect(memberPerms).not.toContain("invite_agents");
    });

    it("should define observer as read-only", () => {
      const observerPerms = ROLE_PERMISSIONS.observer;
      expect(Array.isArray(observerPerms)).toBe(true);
      expect(observerPerms).toHaveLength(0);
    });
  });

  describe("hasChannelPermission", () => {
    it("should return true for owner with any permission", () => {
      expect(hasChannelPermission("owner", "send_messages")).toBe(true);
      expect(hasChannelPermission("owner", "kick_agents")).toBe(true);
      expect(hasChannelPermission("owner", "archive_channel")).toBe(true);
      expect(hasChannelPermission("owner", "manage_settings")).toBe(true);
    });

    it("should check admin permissions correctly", () => {
      expect(hasChannelPermission("admin", "send_messages")).toBe(true);
      expect(hasChannelPermission("admin", "invite_agents")).toBe(true);
      expect(hasChannelPermission("admin", "archive_channel")).toBe(false);
      expect(hasChannelPermission("admin", "manage_settings")).toBe(false);
    });

    it("should check member permissions correctly", () => {
      expect(hasChannelPermission("member", "send_messages")).toBe(true);
      expect(hasChannelPermission("member", "create_threads")).toBe(true);
      expect(hasChannelPermission("member", "invite_agents")).toBe(false);
      expect(hasChannelPermission("member", "kick_agents")).toBe(false);
    });

    it("should return false for observer with any permission", () => {
      expect(hasChannelPermission("observer", "send_messages")).toBe(false);
      expect(hasChannelPermission("observer", "create_threads")).toBe(false);
    });
  });

  describe("CHANNEL_PERMISSIONS", () => {
    it("should define all expected permissions", () => {
      expect(CHANNEL_PERMISSIONS.send_messages).toBe("send_messages");
      expect(CHANNEL_PERMISSIONS.create_threads).toBe("create_threads");
      expect(CHANNEL_PERMISSIONS.invite_agents).toBe("invite_agents");
      expect(CHANNEL_PERMISSIONS.kick_agents).toBe("kick_agents");
      expect(CHANNEL_PERMISSIONS.mute_agents).toBe("mute_agents");
      expect(CHANNEL_PERMISSIONS.set_topic).toBe("set_topic");
      expect(CHANNEL_PERMISSIONS.pin_messages).toBe("pin_messages");
      expect(CHANNEL_PERMISSIONS.archive_channel).toBe("archive_channel");
      expect(CHANNEL_PERMISSIONS.delete_messages).toBe("delete_messages");
      expect(CHANNEL_PERMISSIONS.manage_settings).toBe("manage_settings");
    });
  });
});
