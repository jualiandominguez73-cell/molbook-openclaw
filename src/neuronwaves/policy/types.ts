export type NeuronWavesMode = "safe" | "dev";

export type NeuronWavesActionKind =
  | "draft.email"
  | "send.email"
  | "draft.post"
  | "post.x"
  | "run.command"
  | "edit.files"
  | "git.commit"
  | "git.push"
  | "pr.comment"
  | "spend.money";

export type NeuronWavesDecision = "auto" | "ask" | "deny";

export type NeuronWavesPolicy = {
  /** Safety profile for this agent. */
  mode: NeuronWavesMode;

  /**
   * Dev Approval Mode level.
   * - 1: internal auto, external high-impact ask (default dev behavior)
   * - 2: external high-impact auto with limits + allowlists (recommended)
   * - 3: full auto (user assumes full responsibility; limits may be unlimited)
   */
  devLevel?: 1 | 2 | 3;

  /** Per-action decisions. */
  rules: Partial<Record<NeuronWavesActionKind, NeuronWavesDecision>>;

  /**
   * Guardrail limits.
   * In devLevel=3, these may be set to null (unlimited).
   */
  limits: {
    /** Max external messages/posts per hour (send.email, post.x). */
    outboundPerHour: number | null;
    /** Daily spend cap in USD. Default 0. */
    spendUsdPerDay: number | null;
  };
};

export type NeuronWavesAction = {
  kind: NeuronWavesActionKind;
  summary: string;
  /** Whether this action leaves the machine / impacts the outside world. */
  external: boolean;
  /** Simple risk label to help reporting and policy defaults. */
  risk: "low" | "medium" | "high";
  /**
   * If true, the action can be performed in two phases: prepare artifacts first,
   * then ask before final external execution.
   */
  supportsPrepareThenAct?: boolean;
  /** Optional metadata for later enforcement/allowlisting. */
  meta?: Record<string, unknown>;
};
