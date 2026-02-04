/**
 * File integrator module
 * Handles integrating/copying files into the project structure
 */

import { existsSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { cp, mkdir, readFile, writeFile, rm, rename } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { glob } from "glob";

export interface IntegrateOptions {
  /** Target directory to integrate files into */
  targetDir: string;
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  /** File patterns to include (glob) */
  include?: string[];
  /** File patterns to exclude (glob) */
  exclude?: string[];
  /** Whether to flatten directory structure */
  flatten?: boolean;
  /** Custom file mapping function */
  mapPath?: (sourcePath: string, relativePath: string) => string;
  /** Callback for each file processed */
  onFile?: (source: string, dest: string, action: "copied" | "skipped" | "overwritten") => void;
  /** Whether to create backup of overwritten files */
  backup?: boolean;
  /** Backup directory (defaults to .backup in targetDir) */
  backupDir?: string;
}

export interface IntegrateResult {
  /** Number of files copied */
  copied: number;
  /** Number of files skipped */
  skipped: number;
  /** Number of files overwritten */
  overwritten: number;
  /** List of files that were integrated */
  files: Array<{
    source: string;
    dest: string;
    action: "copied" | "skipped" | "overwritten";
  }>;
  /** Backup directory if backups were created */
  backupDir?: string;
}

/**
 * Integrate files from source to target directory
 */
export async function integrateFile(
  sourcePath: string,
  options: IntegrateOptions
): Promise<IntegrateResult> {
  const {
    targetDir,
    overwrite = false,
    include = ["**/*"],
    exclude = ["**/node_modules/**", "**/.git/**"],
    flatten = false,
    mapPath,
    onFile,
    backup = false,
    backupDir,
  } = options;

  const result: IntegrateResult = {
    copied: 0,
    skipped: 0,
    overwritten: 0,
    files: [],
  };

  // Ensure source exists
  if (!existsSync(sourcePath)) {
    throw new Error(`Source path not found: ${sourcePath}`);
  }

  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const sourceStats = statSync(sourcePath);

  // Handle single file
  if (sourceStats.isFile()) {
    const destPath = join(targetDir, basename(sourcePath));
    await integrateSingleFile(sourcePath, destPath, {
      overwrite,
      backup,
      backupDir,
      onFile,
      result,
    });
    return result;
  }

  // Handle directory
  const files = await glob(include, {
    cwd: sourcePath,
    ignore: exclude,
    nodir: true,
    dot: true,
  });

  // Setup backup directory if needed
  let actualBackupDir: string | undefined;
  if (backup) {
    actualBackupDir = backupDir || join(targetDir, ".backup", new Date().toISOString().replace(/[:.]/g, "-"));
    result.backupDir = actualBackupDir;
  }

  // Process each file
  for (const file of files) {
    const sourceFile = join(sourcePath, file);
    
    let destFile: string;
    if (flatten) {
      destFile = join(targetDir, basename(file));
    } else if (mapPath) {
      destFile = join(targetDir, mapPath(sourceFile, file));
    } else {
      destFile = join(targetDir, file);
    }

    await integrateSingleFile(sourceFile, destFile, {
      overwrite,
      backup,
      backupDir: actualBackupDir,
      onFile,
      result,
    });
  }

  return result;
}

/**
 * Integrate a single file
 */
async function integrateSingleFile(
  source: string,
  dest: string,
  options: {
    overwrite: boolean;
    backup: boolean;
    backupDir?: string;
    onFile?: IntegrateOptions["onFile"];
    result: IntegrateResult;
  }
): Promise<void> {
  const { overwrite, backup, backupDir, onFile, result } = options;

  // Ensure destination directory exists
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    await mkdir(destDir, { recursive: true });
  }

  const destExists = existsSync(dest);
  let action: "copied" | "skipped" | "overwritten";

  if (destExists && !overwrite) {
    action = "skipped";
    result.skipped++;
  } else {
    // Backup existing file if requested
    if (destExists && backup && backupDir) {
      await mkdir(backupDir, { recursive: true });
      const backupPath = join(backupDir, basename(dest));
      await cp(dest, backupPath);
    }

    // Copy file
    await cp(source, dest);
    action = destExists ? "overwritten" : "copied";
    
    if (destExists) {
      result.overwritten++;
    } else {
      result.copied++;
    }
  }

  result.files.push({ source, dest, action });
  
  if (onFile) {
    onFile(source, dest, action);
  }
}

/**
 * Integrate multiple source paths into a target directory
 */
export async function integrateFiles(
  sourcePaths: string[],
  options: IntegrateOptions
): Promise<IntegrateResult> {
  const combined: IntegrateResult = {
    copied: 0,
    skipped: 0,
    overwritten: 0,
    files: [],
  };

  for (const sourcePath of sourcePaths) {
    const result = await integrateFile(sourcePath, options);
    combined.copied += result.copied;
    combined.skipped += result.skipped;
    combined.overwritten += result.overwritten;
    combined.files.push(...result.files);
    
    if (result.backupDir) {
      combined.backupDir = result.backupDir;
    }
  }

  return combined;
}

/**
 * Merge JSON files during integration
 */
export async function mergeJsonFile(
  sourcePath: string,
  destPath: string,
  options?: {
    /** Deep merge objects (default: true) */
    deep?: boolean;
    /** Array merge strategy */
    arrayMerge?: "concat" | "replace" | "unique";
  }
): Promise<void> {
  const { deep = true, arrayMerge = "concat" } = options || {};

  let destData: Record<string, unknown> = {};
  
  if (existsSync(destPath)) {
    const destContent = await readFile(destPath, "utf-8");
    destData = JSON.parse(destContent);
  }

  const sourceContent = await readFile(sourcePath, "utf-8");
  const sourceData = JSON.parse(sourceContent);

  const merged = deep
    ? deepMerge(destData, sourceData, arrayMerge)
    : { ...destData, ...sourceData };

  await writeFile(destPath, JSON.stringify(merged, null, 2) + "\n");
}

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  arrayMerge: "concat" | "replace" | "unique"
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];

    if (Array.isArray(sourceVal)) {
      if (Array.isArray(targetVal)) {
        switch (arrayMerge) {
          case "concat":
            result[key] = [...targetVal, ...sourceVal];
            break;
          case "unique":
            result[key] = [...new Set([...targetVal, ...sourceVal])];
            break;
          case "replace":
          default:
            result[key] = sourceVal;
        }
      } else {
        result[key] = sourceVal;
      }
    } else if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal)
    ) {
      if (
        targetVal !== null &&
        typeof targetVal === "object" &&
        !Array.isArray(targetVal)
      ) {
        result[key] = deepMerge(
          targetVal as Record<string, unknown>,
          sourceVal as Record<string, unknown>,
          arrayMerge
        );
      } else {
        result[key] = sourceVal;
      }
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

/**
 * Create a module index file for integrated files
 */
export async function createModuleIndex(
  dir: string,
  options?: {
    /** File extension to look for */
    extension?: string;
    /** Output filename */
    outputFile?: string;
    /** Export style */
    exportStyle?: "named" | "default" | "star";
  }
): Promise<string> {
  const {
    extension = ".ts",
    outputFile = "index.ts",
    exportStyle = "star",
  } = options || {};

  const files = readdirSync(dir).filter(
    (f) => f.endsWith(extension) && f !== outputFile
  );

  let content = "// Auto-generated index file\n\n";

  for (const file of files) {
    const moduleName = basename(file, extension);
    
    switch (exportStyle) {
      case "star":
        content += `export * from "./${moduleName}.js";\n`;
        break;
      case "named":
        content += `export { ${moduleName} } from "./${moduleName}.js";\n`;
        break;
      case "default":
        content += `export { default as ${moduleName} } from "./${moduleName}.js";\n`;
        break;
    }
  }

  const outputPath = join(dir, outputFile);
  await writeFile(outputPath, content);
  
  return outputPath;
}

/**
 * Validate integration by checking required files exist
 */
export async function validateIntegration(
  targetDir: string,
  requiredFiles: string[]
): Promise<{ valid: boolean; missing: string[] }> {
  const missing: string[] = [];

  for (const file of requiredFiles) {
    const fullPath = join(targetDir, file);
    if (!existsSync(fullPath)) {
      missing.push(file);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Rollback an integration using backup
 */
export async function rollbackIntegration(
  backupDir: string,
  targetDir: string
): Promise<number> {
  if (!existsSync(backupDir)) {
    throw new Error(`Backup directory not found: ${backupDir}`);
  }

  const files = readdirSync(backupDir);
  let restored = 0;

  for (const file of files) {
    const backupPath = join(backupDir, file);
    const targetPath = join(targetDir, file);
    
    await cp(backupPath, targetPath, { force: true });
    restored++;
  }

  return restored;
}
