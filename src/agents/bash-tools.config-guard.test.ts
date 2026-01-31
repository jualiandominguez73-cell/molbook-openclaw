/**
 * Config Guard Unit Tests
 * Tests all write patterns and bypass vectors from Lux's review
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  checkCommandForProtectedPaths,
  buildGuardErrorMessage,
  DEFAULT_PROTECTED_PATHS,
} from "./bash-tools.config-guard.js";

describe("Config Guard", () => {
  // Use realpath to get the canonical tmp dir (macOS: /var → /private/var)
  const testDir = path.join(fs.realpathSync(os.tmpdir()), `config-guard-test-${Date.now()}`);
  const testConfigPath = path.join(testDir, "moltbot.json");
  const testSymlinkPath = path.join(testDir, "symlink-to-config");
  const protectedPaths = [testConfigPath];

  beforeAll(() => {
    // Create test directory and files
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testConfigPath, '{"test": true}');

    // Create symlink for symlink bypass tests
    try {
      fs.symlinkSync(testConfigPath, testSymlinkPath);
    } catch (err) {
      console.warn("Could not create symlink for testing (Windows?):", err);
    }
  });

  afterAll(() => {
    // Cleanup
    try {
      if (fs.existsSync(testSymlinkPath)) {
        fs.unlinkSync(testSymlinkPath);
      }
      if (fs.existsSync(testConfigPath)) {
        fs.unlinkSync(testConfigPath);
      }
      fs.rmdirSync(testDir);
    } catch (err) {
      console.warn("Cleanup error:", err);
    }
  });

  describe("Direct write patterns", () => {
    it("should block direct redirect", () => {
      const result = checkCommandForProtectedPaths(`echo 'bad' > ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
      expect(result.matchedPath).toBe(testConfigPath);
    });

    it("should block append redirect", () => {
      const result = checkCommandForProtectedPaths(`echo 'bad' >> ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
    });

    it("should block cat redirect", () => {
      const result = checkCommandForProtectedPaths(`cat /tmp/file > ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
    });

    it("should NOT block reading (no write)", () => {
      const result = checkCommandForProtectedPaths(`cat ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });

    it("should NOT block redirect to different file", () => {
      const result = checkCommandForProtectedPaths("echo 'safe' > /tmp/other-file.txt", {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });
  });

  describe("In-place editors", () => {
    it("should block sed -i", () => {
      const result = checkCommandForProtectedPaths(`sed -i 's/old/new/' ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("in-place editor");
      expect(result.matchedPattern).toBe("sed -i");
    });

    it("should block awk -i inplace", () => {
      const result = checkCommandForProtectedPaths(`awk -i inplace '{print}' ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.matchedPattern).toBe("awk -i");
    });

    it("should block perl -pi", () => {
      const result = checkCommandForProtectedPaths(`perl -pi -e 's/old/new/' ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.matchedPattern).toBe("perl -i");
    });

    it("should NOT block sed without -i", () => {
      const result = checkCommandForProtectedPaths(`sed 's/old/new/' ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });
  });

  describe("File manipulation commands", () => {
    it("should block cp to protected path", () => {
      const result = checkCommandForProtectedPaths(`cp /tmp/file ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("file manipulation command");
    });

    it("should block mv to protected path", () => {
      const result = checkCommandForProtectedPaths(`mv /tmp/file ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("file manipulation command");
    });

    it("should block tee", () => {
      const result = checkCommandForProtectedPaths(`echo 'bad' | tee ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("file manipulation command");
    });

    it("should block dd of=", () => {
      const result = checkCommandForProtectedPaths(`echo 'bad' | dd of=${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("file manipulation command");
    });
  });

  describe("Text editors", () => {
    it("should block ex", () => {
      const result = checkCommandForProtectedPaths(
        `ex -c '1,\$d' -c 'i' -c 'bad' -c '.' -c 'wq' ${testConfigPath}`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("text editor");
      expect(result.matchedPattern).toBe("ex");
    });

    it("should block vim", () => {
      const result = checkCommandForProtectedPaths(
        `vim -c 'normal! ggdGibad config' -c 'wq' ${testConfigPath}`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(true);
      expect(result.matchedPattern).toBe("vim");
    });
  });

  describe("Script writes", () => {
    it("should block python write", () => {
      const result = checkCommandForProtectedPaths(
        `python -c "open('${testConfigPath}', 'w').write('bad')"`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("script file write operation");
    });

    it("should block node writeFile", () => {
      const result = checkCommandForProtectedPaths(
        `node -e "require('fs').writeFileSync('${testConfigPath}', 'bad')"`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("script file write operation");
    });

    it("should block ruby write", () => {
      const result = checkCommandForProtectedPaths(
        `ruby -e "File.write('${testConfigPath}', 'bad')"`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("script file write operation");
    });
  });

  describe("Lux bypass vectors", () => {
    it("should block symlink bypass", () => {
      if (!fs.existsSync(testSymlinkPath)) {
        console.warn("Skipping symlink test - symlink creation failed");
        return;
      }

      // Symlink points to protected file
      const result = checkCommandForProtectedPaths(`echo 'bad' > ${testSymlinkPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
      // Should resolve symlink and match the real path
      expect(result.matchedPath).toBe(testConfigPath);
    });

    it("should block relative path bypass", () => {
      const configFilename = path.basename(testConfigPath);
      const result = checkCommandForProtectedPaths(`echo 'bad' > ${configFilename}`, {
        protectedPaths,
        cwd: testDir, // cwd is the test directory
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
    });

    it("should block relative path with ..", () => {
      const relPath = path.relative(path.join(testDir, "subdir"), testConfigPath);
      const result = checkCommandForProtectedPaths(`echo 'bad' > ${relPath}`, {
        protectedPaths,
        cwd: path.join(testDir, "subdir"),
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
    });

    it("should handle ~ expansion", () => {
      const homeConfig = "~/.clawdbot/moltbot.json";
      const expanded = path.join(os.homedir(), ".clawdbot/moltbot.json");

      const result = checkCommandForProtectedPaths(`echo 'bad' > ${homeConfig}`, {
        protectedPaths: [expanded],
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
    });

    it("should handle quoted paths", () => {
      const result = checkCommandForProtectedPaths(`echo 'bad' > "${testConfigPath}"`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
    });

    it("should handle single-quoted paths", () => {
      const result = checkCommandForProtectedPaths(`echo 'bad' > '${testConfigPath}'`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("output redirect");
    });

    it("should detect multi-stage commands (chained)", () => {
      const result = checkCommandForProtectedPaths(
        `echo 'bad' > /tmp/x && mv /tmp/x ${testConfigPath}`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("file manipulation command");
    });
  });

  describe("Relative path bypass vectors (Parker QA)", () => {
    it("should block cd && redirect with bare filename", () => {
      const result = checkCommandForProtectedPaths(
        `cd ${testDir} && echo 'bypass' > moltbot.json`,
        { protectedPaths, cwd: "/tmp" },
      );

      expect(result.blocked).toBe(true);
      // May match via effective cwd tracking ("output redirect") or basename fallback
      expect(["output redirect", "basename match on protected config filename"]).toContain(
        result.reason,
      );
    });

    it("should block cd ; redirect with bare filename", () => {
      const result = checkCommandForProtectedPaths(`cd ${testDir}; echo 'bypass' > moltbot.json`, {
        protectedPaths,
        cwd: "/tmp",
      });

      expect(result.blocked).toBe(true);
    });

    it("should block cd ~ && redirect with bare filename", () => {
      const homeConfig = path.join(os.homedir(), ".clawdbot/moltbot.json");
      const result = checkCommandForProtectedPaths(
        `cd ~/.clawdbot && echo 'bypass' > moltbot.json`,
        { protectedPaths: [homeConfig], cwd: "/tmp" },
      );

      expect(result.blocked).toBe(true);
    });

    it("should block bare moltbot.json redirect even without cd", () => {
      const result = checkCommandForProtectedPaths(`echo 'bypass' > moltbot.json`, {
        protectedPaths,
        cwd: "/tmp",
      });

      expect(result.blocked).toBe(true);
      // Basename fallback catches this when full path doesn't match
      expect(["output redirect", "basename match on protected config filename"]).toContain(
        result.reason,
      );
    });

    it("should block bare exec-approvals.json redirect", () => {
      const approvalsPath = path.join(testDir, "exec-approvals.json");
      const result = checkCommandForProtectedPaths(`echo '{}' > exec-approvals.json`, {
        protectedPaths: [approvalsPath],
        cwd: "/tmp",
      });

      expect(result.blocked).toBe(true);
    });

    it("should block cp to bare moltbot.json with cd chain", () => {
      const result = checkCommandForProtectedPaths(
        `cd ${testDir} && cp /tmp/evil.json moltbot.json`,
        { protectedPaths, cwd: "/tmp" },
      );

      expect(result.blocked).toBe(true);
    });

    it("should block tee to bare moltbot.json", () => {
      const result = checkCommandForProtectedPaths(`echo 'bad' | tee moltbot.json`, {
        protectedPaths,
        cwd: "/tmp",
      });

      expect(result.blocked).toBe(true);
    });

    it("should NOT block writing to similarly-named but different file", () => {
      const result = checkCommandForProtectedPaths(`echo 'safe' > my-moltbot.json.bak`, {
        protectedPaths,
        cwd: "/tmp",
      });

      expect(result.blocked).toBe(false);
    });
  });

  describe("False positives (should NOT block)", () => {
    it("should allow backup creation", () => {
      const result = checkCommandForProtectedPaths(`tar czf backup.tar.gz ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });

    it("should allow diff output", () => {
      const result = checkCommandForProtectedPaths(
        `git diff ${testConfigPath} > /tmp/changes.patch`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(false);
    });

    it("should allow documentation generation mentioning path", () => {
      const result = checkCommandForProtectedPaths(
        `echo "Config location: ${testConfigPath}" > README.md`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(false);
    });

    it("should allow jq read", () => {
      const result = checkCommandForProtectedPaths(`jq . ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });

    it("should allow grep", () => {
      const result = checkCommandForProtectedPaths(`grep "pattern" ${testConfigPath}`, {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });
  });

  describe("Error message", () => {
    it("should generate helpful error message", () => {
      const command = `echo 'bad config' > ~/.clawdbot/moltbot.json`;
      const result = {
        blocked: true,
        reason: "output redirect",
        matchedPath: path.join(os.homedir(), ".clawdbot/moltbot.json"),
        matchedPattern: ">",
      };

      const errorMsg = buildGuardErrorMessage(command, result);

      expect(errorMsg).toContain("❌ Exec blocked");
      expect(errorMsg).toContain("~/.clawdbot/moltbot.json");
      expect(errorMsg).toContain("output redirect");
      expect(errorMsg).toContain("config.patch");
      expect(errorMsg).toContain("Validates against schema");
    });
  });

  describe("Edge cases", () => {
    it("should handle commands with multiple redirects", () => {
      const result = checkCommandForProtectedPaths(
        `echo 'safe' > /tmp/log.txt 2> /tmp/err.txt; echo 'bad' > ${testConfigPath}`,
        { protectedPaths, cwd: testDir },
      );

      expect(result.blocked).toBe(true);
    });

    it("should handle empty command", () => {
      const result = checkCommandForProtectedPaths("", {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });

    it("should handle command with no matches", () => {
      const result = checkCommandForProtectedPaths("ls -la /tmp", {
        protectedPaths,
        cwd: testDir,
      });

      expect(result.blocked).toBe(false);
    });
  });

  describe("Default protected paths", () => {
    it("should include moltbot.json by default", () => {
      expect(DEFAULT_PROTECTED_PATHS).toContain("~/.clawdbot/moltbot.json");
    });

    it("should include exec-approvals.json by default", () => {
      expect(DEFAULT_PROTECTED_PATHS).toContain("~/.clawdbot/exec-approvals.json");
    });
  });
});
