export type GrayswanStageConfig = {
  /** Enable the guardrail stage. */
  enabled?: boolean;
  /** Behavior when a violation is detected. */
  mode?: "block" | "monitor";
  /** Override the violation threshold for this stage (0-1). */
  violationThreshold?: number;
  /** How to apply guardrail messaging when blocking. */
  blockMode?: "replace" | "append";
  /** Treat mutation detection as a violation for this stage. */
  blockOnMutation?: boolean;
  /** Treat IPI detection as a violation for this stage. */
  blockOnIpi?: boolean;
  /** Include conversation history in the Gray Swan request. */
  includeHistory?: boolean;
};

export type GrayswanGuardrailConfig = {
  enabled?: boolean;
  /** Gray Swan Cygnal API key. */
  apiKey?: string;
  /** Override for Gray Swan API base URL. */
  apiBase?: string;
  /** Gray Swan policy identifier. */
  policyId?: string;
  /** Custom category descriptions. */
  categories?: Record<string, string>;
  /** Gray Swan reasoning mode. */
  reasoningMode?: "off" | "hybrid" | "thinking";
  /** Default violation threshold (0-1). */
  violationThreshold?: number;
  /** Timeout for Gray Swan requests (ms). */
  timeoutMs?: number;
  /** Allow requests to proceed when Gray Swan errors. */
  failOpen?: boolean;
  stages?: {
    beforeRequest?: GrayswanStageConfig;
    beforeToolCall?: GrayswanStageConfig;
    afterToolCall?: GrayswanStageConfig;
    afterResponse?: GrayswanStageConfig;
  };
};

export type GuardrailsConfig = {
  grayswan?: GrayswanGuardrailConfig;
};
