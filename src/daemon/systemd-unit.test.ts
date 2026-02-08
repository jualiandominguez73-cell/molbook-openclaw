import { describe, expect, it } from "vitest";
import { buildSystemdUnit, parseSystemdExecStart } from "./systemd-unit.js";

describe("parseSystemdExecStart", () => {
  it("splits on whitespace outside quotes", () => {
    const execStart = "/usr/bin/openclaw gateway start --foo bar";
    expect(parseSystemdExecStart(execStart)).toEqual([
      "/usr/bin/openclaw",
      "gateway",
      "start",
      "--foo",
      "bar",
    ]);
  });

  it("preserves quoted arguments", () => {
    const execStart = '/usr/bin/openclaw gateway start --name "My Bot"';
    expect(parseSystemdExecStart(execStart)).toEqual([
      "/usr/bin/openclaw",
      "gateway",
      "start",
      "--name",
      "My Bot",
    ]);
  });

  it("parses path arguments", () => {
    const execStart = "/usr/bin/openclaw gateway start --path /tmp/openclaw";
    expect(parseSystemdExecStart(execStart)).toEqual([
      "/usr/bin/openclaw",
      "gateway",
      "start",
      "--path",
      "/tmp/openclaw",
    ]);
  });
});

describe("buildSystemdUnit", () => {
  it("includes Type=notify for sd_notify readiness protocol", () => {
    const unit = buildSystemdUnit({
      programArguments: ["/usr/bin/openclaw", "gateway", "start"],
    });
    expect(unit).toContain("Type=notify");
  });

  it("includes NotifyAccess=all so child processes can notify", () => {
    const unit = buildSystemdUnit({
      programArguments: ["/usr/bin/openclaw", "gateway", "start"],
    });
    expect(unit).toContain("NotifyAccess=all");
  });

  it("includes WatchdogSec=90 for hang detection", () => {
    const unit = buildSystemdUnit({
      programArguments: ["/usr/bin/openclaw", "gateway", "start"],
    });
    expect(unit).toContain("WatchdogSec=90");
  });

  it("places watchdog directives in [Service] section", () => {
    const unit = buildSystemdUnit({
      programArguments: ["/usr/bin/openclaw", "gateway", "start"],
    });
    const serviceStart = unit.indexOf("[Service]");
    const installStart = unit.indexOf("[Install]");
    const typePos = unit.indexOf("Type=notify");
    const notifyAccessPos = unit.indexOf("NotifyAccess=all");
    const watchdogPos = unit.indexOf("WatchdogSec=90");
    expect(typePos).toBeGreaterThan(serviceStart);
    expect(typePos).toBeLessThan(installStart);
    expect(notifyAccessPos).toBeGreaterThan(serviceStart);
    expect(notifyAccessPos).toBeLessThan(installStart);
    expect(watchdogPos).toBeGreaterThan(serviceStart);
    expect(watchdogPos).toBeLessThan(installStart);
  });
});
