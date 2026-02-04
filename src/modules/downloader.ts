/**
 * File downloader module
 * Handles downloading files from URLs and extracting archives
 */

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { mkdir, rm, rename } from "node:fs/promises";
import { basename, join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { Extract } from "unzipper";

export interface DownloadOptions {
  /** Destination directory for downloaded file */
  destDir: string;
  /** Custom filename (defaults to URL basename) */
  filename?: string;
  /** Whether to extract if archive (zip, tar.gz) */
  extract?: boolean;
  /** Directory to extract contents to */
  extractDir?: string;
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Progress callback */
  onProgress?: (downloaded: number, total: number) => void;
}

export interface DownloadResult {
  /** Path to downloaded/extracted file or directory */
  path: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  size: number;
  /** Whether file was extracted */
  extracted: boolean;
}

/**
 * Download a file from a URL
 */
export async function downloadFile(
  url: string,
  options: DownloadOptions
): Promise<DownloadResult> {
  const { destDir, overwrite = false, onProgress } = options;
  
  // Ensure destination directory exists
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  const filename = options.filename || basename(new URL(url).pathname);
  const destPath = join(destDir, filename);

  // Check if file exists
  if (existsSync(destPath) && !overwrite) {
    throw new Error(`File already exists: ${destPath}. Use overwrite: true to replace.`);
  }

  // Download file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get("content-length")) || 0;
  let downloaded = 0;

  // Create write stream
  const fileStream = createWriteStream(destPath);
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Failed to get response body reader");
  }

  // Stream download with progress
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    fileStream.write(value);
    downloaded += value.length;

    if (onProgress && contentLength > 0) {
      onProgress(downloaded, contentLength);
    }
  }

  fileStream.end();

  // Wait for write to complete
  await new Promise<void>((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });

  // Handle extraction if requested
  const shouldExtract = options.extract !== false && isArchive(filename);
  let resultPath = destPath;
  let extracted = false;

  if (shouldExtract) {
    const extractDir = options.extractDir || join(destDir, basename(filename, getArchiveExtension(filename)));
    resultPath = await extractArchive(destPath, extractDir);
    extracted = true;
  }

  return {
    path: resultPath,
    filename,
    size: downloaded,
    extracted,
  };
}

/**
 * Download multiple files in parallel
 */
export async function downloadFiles(
  urls: string[],
  options: Omit<DownloadOptions, "filename">
): Promise<DownloadResult[]> {
  return Promise.all(urls.map((url) => downloadFile(url, options)));
}

/**
 * Check if a filename is an archive
 */
export function isArchive(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.endsWith(".zip") ||
    lower.endsWith(".tar.gz") ||
    lower.endsWith(".tgz") ||
    lower.endsWith(".tar")
  );
}

/**
 * Get archive extension
 */
function getArchiveExtension(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".tar.gz")) return ".tar.gz";
  if (lower.endsWith(".tgz")) return ".tgz";
  if (lower.endsWith(".tar")) return ".tar";
  if (lower.endsWith(".zip")) return ".zip";
  return "";
}

/**
 * Extract an archive file
 */
export async function extractArchive(
  archivePath: string,
  destDir: string
): Promise<string> {
  const lower = archivePath.toLowerCase();

  // Ensure destination exists
  await mkdir(destDir, { recursive: true });

  if (lower.endsWith(".zip")) {
    return extractZip(archivePath, destDir);
  } else if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    return extractTarGz(archivePath, destDir);
  } else if (lower.endsWith(".tar")) {
    return extractTar(archivePath, destDir);
  }

  throw new Error(`Unsupported archive format: ${archivePath}`);
}

/**
 * Extract a ZIP file
 */
async function extractZip(zipPath: string, destDir: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  
  await pipeline(
    createReadStream(zipPath),
    Extract({ path: destDir })
  );

  return destDir;
}

/**
 * Extract a tar.gz file
 */
async function extractTarGz(tarGzPath: string, destDir: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  const tar = await import("tar");

  await pipeline(
    createReadStream(tarGzPath),
    createGunzip(),
    tar.extract({ cwd: destDir })
  );

  return destDir;
}

/**
 * Extract a tar file
 */
async function extractTar(tarPath: string, destDir: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  const tar = await import("tar");

  await pipeline(
    createReadStream(tarPath),
    tar.extract({ cwd: destDir })
  );

  return destDir;
}

/**
 * Extract a local archive file
 */
export async function extractLocalArchive(
  archivePath: string,
  destDir?: string
): Promise<string> {
  if (!existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }

  const extractDir = destDir || join(
    dirname(archivePath),
    basename(archivePath, getArchiveExtension(archivePath)) + "_extracted"
  );

  return extractArchive(archivePath, extractDir);
}

/**
 * Clean up downloaded/extracted files
 */
export async function cleanupDownload(path: string): Promise<void> {
  if (existsSync(path)) {
    await rm(path, { recursive: true, force: true });
  }
}
