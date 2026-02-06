/**
 * OpenSCAD CLI renderer
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const execAsync = promisify(exec);

export interface RenderOptions {
  openscadPath: string;
  outputDir: string;
  format: 'stl' | '3mf' | 'off' | 'amf' | 'png';
  code: string;
  modelName: string;
}

export interface RenderResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  stderr?: string;
}

export async function checkOpenSCADAvailable(openscadPath: string): Promise<boolean> {
  try {
    await execAsync(`"${openscadPath}" --version`);
    return true;
  } catch {
    return false;
  }
}

export async function renderModel(options: RenderOptions): Promise<RenderResult> {
  const { openscadPath, outputDir, format, code, modelName } = options;

  try {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Write code to temporary .scad file
    const scadPath = join(outputDir, `${modelName}.scad`);
    await writeFile(scadPath, code, 'utf-8');

    // Determine output path
    const outputPath = join(outputDir, `${modelName}.${format}`);

    // Build OpenSCAD command
    const cmd = `"${openscadPath}" -o "${outputPath}" "${scadPath}"`;

    // Execute OpenSCAD
    const { stderr } = await execAsync(cmd, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Check if output file was created
    if (!existsSync(outputPath)) {
      return {
        success: false,
        error: 'OpenSCAD did not create output file',
        stderr,
      };
    }

    return {
      success: true,
      outputPath,
      stderr: stderr || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function renderPreview(options: {
  openscadPath: string;
  outputDir: string;
  code: string;
  modelName: string;
  size?: number;
}): Promise<RenderResult> {
  return renderModel({
    ...options,
    format: 'png',
  });
}
