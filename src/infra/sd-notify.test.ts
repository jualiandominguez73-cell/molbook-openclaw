import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { sdNotifyReady, sdNotifyWatchdog } from "./sd-notify.js";

describe("sdNotifyReady", () => {
  const origNotifySocket = process.env.NOTIFY_SOCKET;

  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    if (origNotifySocket === undefined) {
      delete process.env.NOTIFY_SOCKET;
    } else {
      process.env.NOTIFY_SOCKET = origNotifySocket;
    }
  });

  it("is a no-op when NOTIFY_SOCKET is not set", () => {
    delete process.env.NOTIFY_SOCKET;
    sdNotifyReady();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("calls systemd-notify --ready when NOTIFY_SOCKET is set", () => {
    process.env.NOTIFY_SOCKET = "/run/user/1000/systemd/notify";
    sdNotifyReady();
    expect(execFileMock).toHaveBeenCalledOnce();
    expect(execFileMock).toHaveBeenCalledWith(
      "systemd-notify",
      ["--ready"],
      { timeout: 5000 },
      expect.any(Function),
    );
  });
});

describe("sdNotifyWatchdog", () => {
  const origNotifySocket = process.env.NOTIFY_SOCKET;

  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    if (origNotifySocket === undefined) {
      delete process.env.NOTIFY_SOCKET;
    } else {
      process.env.NOTIFY_SOCKET = origNotifySocket;
    }
  });

  it("is a no-op when NOTIFY_SOCKET is not set", () => {
    delete process.env.NOTIFY_SOCKET;
    sdNotifyWatchdog();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it("calls systemd-notify WATCHDOG=1 when NOTIFY_SOCKET is set", () => {
    process.env.NOTIFY_SOCKET = "/run/user/1000/systemd/notify";
    sdNotifyWatchdog();
    expect(execFileMock).toHaveBeenCalledOnce();
    expect(execFileMock).toHaveBeenCalledWith(
      "systemd-notify",
      ["WATCHDOG=1"],
      { timeout: 5000 },
      expect.any(Function),
    );
  });
});
