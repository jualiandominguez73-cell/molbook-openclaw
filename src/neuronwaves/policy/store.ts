import fs from "node:fs/promises";
import path from "node:path";
import type { NeuronWavesPolicy } from "./types.js";
import { resolveNeuronWavesDir } from "../state.js";
import { defaultNeuronWavesPolicy } from "./defaults.js";

export function resolveNeuronWavesPolicyPath(workspaceDir: string) {
  return path.join(resolveNeuronWavesDir(workspaceDir), "policy.json");
}

export async function loadNeuronWavesPolicy(workspaceDir: string): Promise<NeuronWavesPolicy> {
  const file = resolveNeuronWavesPolicyPath(workspaceDir);
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as Partial<NeuronWavesPolicy>;
    if (parsed && typeof parsed === "object") {
      const base = defaultNeuronWavesPolicy();
      const devLevel =
        parsed.devLevel === 1 || parsed.devLevel === 2 || parsed.devLevel === 3
          ? parsed.devLevel
          : base.devLevel;
      const limitsRaw = parsed.limits ?? {};
      const outboundPerHour =
        limitsRaw.outboundPerHour === null
          ? null
          : typeof limitsRaw.outboundPerHour === "number" &&
              Number.isFinite(limitsRaw.outboundPerHour)
            ? limitsRaw.outboundPerHour
            : base.limits.outboundPerHour;
      const spendUsdPerDay =
        limitsRaw.spendUsdPerDay === null
          ? null
          : typeof limitsRaw.spendUsdPerDay === "number" &&
              Number.isFinite(limitsRaw.spendUsdPerDay)
            ? limitsRaw.spendUsdPerDay
            : base.limits.spendUsdPerDay;

      return {
        ...base,
        ...parsed,
        devLevel,
        rules: { ...base.rules, ...(parsed.rules ?? {}) },
        limits: {
          outboundPerHour,
          spendUsdPerDay,
        },
      };
    }
  } catch {
    // ignore
  }
  return defaultNeuronWavesPolicy();
}

export async function saveNeuronWavesPolicy(workspaceDir: string, policy: NeuronWavesPolicy) {
  const dir = resolveNeuronWavesDir(workspaceDir);
  await fs.mkdir(dir, { recursive: true });
  const file = resolveNeuronWavesPolicyPath(workspaceDir);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(policy, null, 2) + "\n", "utf-8");
  await fs.rename(tmp, file);
}
