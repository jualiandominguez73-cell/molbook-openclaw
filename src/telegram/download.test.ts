import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { downloadTelegramFile, getTelegramFile, type TelegramFileInfo } from "./download.js";

describe("telegram download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches file info", async () => {
    const json = vi.fn().mockResolvedValue({ ok: true, result: { file_path: "photos/1.jpg" } });
    vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json,
    } as any);
    const info = await getTelegramFile("tok", "fid");
    expect(info.file_path).toBe("photos/1.jpg");
  });

  it("downloads and saves from HTTP when path is relative", async () => {
    const info: TelegramFileInfo = {
      file_id: "fid",
      file_path: "photos/1.jpg",
    };
    const arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
    vi.spyOn(global, "fetch" as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      body: true,
      arrayBuffer,
      headers: { get: () => "image/jpeg" },
    } as any);
    const saved = await downloadTelegramFile("tok", info, 1024 * 1024);
    expect(saved.path).toBeTruthy();
    expect(saved.contentType).toBe("image/jpeg");
  });

  describe("local file path detection", () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "telegram-test-"));
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
    });

    it("reads from filesystem when path is absolute Unix path", async () => {
      const testFile = path.join(tempDir, "test.jpg");
      const testData = Buffer.from([1, 2, 3, 4]);
      await fs.writeFile(testFile, testData);

      const info: TelegramFileInfo = {
        file_id: "fid",
        file_path: testFile,
      };

      const saved = await downloadTelegramFile("tok", info);
      expect(saved.path).toBeTruthy();
      expect(saved.contentType).toBeTruthy();
    });

    it("reads from filesystem when path is absolute Windows path", async () => {
      const testFile = path.join(tempDir, "test.jpg");
      const testData = Buffer.from([1, 2, 3, 4]);
      await fs.writeFile(testFile, testData);

      const info: TelegramFileInfo = {
        file_id: "fid",
        file_path: testFile,
      };

      const saved = await downloadTelegramFile("tok", info);
      expect(saved.path).toBeTruthy();
    });

    it("throws error when local file does not exist", async () => {
      const nonExistentPath = path.join(tempDir, "nonexistent.jpg");

      const info: TelegramFileInfo = {
        file_id: "fid",
        file_path: nonExistentPath,
      };

      await expect(downloadTelegramFile("tok", info)).rejects.toThrow();
    });
  });

  describe("custom API base", () => {
    it("uses custom API base for HTTP downloads when provided", async () => {
      const fetchSpy = vi.spyOn(global, "fetch" as any);
      const info: TelegramFileInfo = {
        file_id: "fid",
        file_path: "photos/1.jpg",
      };
      const arrayBuffer = async () => new Uint8Array([1, 2, 3, 4]).buffer;
      fetchSpy.mockImplementation(((url: any) => {
        if ((url as string).includes("/file/bot")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            body: true,
            arrayBuffer,
            headers: { get: () => "image/jpeg" },
          } as any);
        }
        throw new Error(`Unexpected fetch call: ${url}`);
      }) as any);

      const customApiBase = "http://localhost:8081";
      await downloadTelegramFile("tok", info, 1024 * 1024, customApiBase);

      expect(fetchSpy).toHaveBeenCalled();
      const downloadCall = fetchSpy.mock.calls.find((call) =>
        (call[0] as string).includes("/file/bot"),
      );
      expect(downloadCall).toBeDefined();
      const callUrl = (downloadCall?.[0] as string) || "";
      expect(callUrl).toContain("localhost:8081");
    });
  });
});
