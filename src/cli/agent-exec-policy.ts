export function isAgentExecutionDisabled(): boolean {
  // default: disabled in Phase 1 hardening
  // allow override when you intentionally re-enable
  const v = process.env.OPENCLAW_ENABLE_AGENT_EXECUTION;
  if (!v) return true;
  return !["1", "true", "yes", "on"].includes(v.toLowerCase());
}