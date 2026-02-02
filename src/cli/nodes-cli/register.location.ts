import type { Command } from "commander";
import { randomIdempotencyKey } from "../../gateway/call.js";
import { defaultRuntime } from "../../runtime.js";
import { runNodesCommand } from "./cli-utils.js";
import { callGatewayCli, nodesCallOpts, resolveNodeId } from "./rpc.js";
import type { NodesRpcOpts } from "./types.js";

export function registerNodesLocationCommands(nodes: Command) {
  const location = nodes.command("location").description("从已配对节点获取位置");

  nodesCallOpts(
    location
      .command("get")
      .description("从节点获取当前位置")
      .requiredOption("--node <idOrNameOrIp>", "节点 ID、名称或 IP")
      .option("--max-age <ms>", "使用此时间内的缓存位置 (毫秒)")
      .option(
        "--accuracy <coarse|balanced|precise>",
        "期望精度 (默认: 取决于节点设置的 balanced/precise)",
      )
      .option("--location-timeout <ms>", "定位超时 (毫秒)", "10000")
      .option("--invoke-timeout <ms>", "节点调用超时毫秒数 (默认 20000)", "20000")
      .action(async (opts: NodesRpcOpts) => {
        await runNodesCommand("location get", async () => {
          const nodeId = await resolveNodeId(opts, String(opts.node ?? ""));
          const maxAgeMs = opts.maxAge ? Number.parseInt(String(opts.maxAge), 10) : undefined;
          const desiredAccuracyRaw =
            typeof opts.accuracy === "string" ? opts.accuracy.trim().toLowerCase() : undefined;
          const desiredAccuracy =
            desiredAccuracyRaw === "coarse" ||
            desiredAccuracyRaw === "balanced" ||
            desiredAccuracyRaw === "precise"
              ? desiredAccuracyRaw
              : undefined;
          const timeoutMs = opts.locationTimeout
            ? Number.parseInt(String(opts.locationTimeout), 10)
            : undefined;
          const invokeTimeoutMs = opts.invokeTimeout
            ? Number.parseInt(String(opts.invokeTimeout), 10)
            : undefined;

          const invokeParams: Record<string, unknown> = {
            nodeId,
            command: "location.get",
            params: {
              maxAgeMs: Number.isFinite(maxAgeMs) ? maxAgeMs : undefined,
              desiredAccuracy,
              timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
            },
            idempotencyKey: randomIdempotencyKey(),
          };
          if (typeof invokeTimeoutMs === "number" && Number.isFinite(invokeTimeoutMs)) {
            invokeParams.timeoutMs = invokeTimeoutMs;
          }

          const raw = (await callGatewayCli("node.invoke", opts, invokeParams)) as unknown;
          const res = typeof raw === "object" && raw !== null ? (raw as { payload?: unknown }) : {};
          const payload =
            res.payload && typeof res.payload === "object"
              ? (res.payload as Record<string, unknown>)
              : {};

          if (opts.json) {
            defaultRuntime.log(JSON.stringify(payload, null, 2));
            return;
          }

          const lat = payload.lat;
          const lon = payload.lon;
          const acc = payload.accuracyMeters;
          if (typeof lat === "number" && typeof lon === "number") {
            const accText = typeof acc === "number" ? ` ±${acc.toFixed(1)}m` : "";
            defaultRuntime.log(`${lat},${lon}${accText}`);
            return;
          }
          defaultRuntime.log(JSON.stringify(payload));
        });
      }),
    { timeoutMs: 30_000 },
  );
}
