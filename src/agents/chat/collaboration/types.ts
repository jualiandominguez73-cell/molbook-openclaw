/**
 * Types for multi-agent collaboration patterns.
 */

export type CollaborationMode =
  | "war-room" // All agents active simultaneously
  | "expert-panel" // Specialists activated by topic
  | "chain-of-thought" // Sequential processing
  | "consensus" // Voting/agreement between agents
  | "coordinator"; // One agent routes to others

export type CollaborationStatus = "active" | "paused" | "completed" | "cancelled";

export type ParticipantRole = "coordinator" | "participant" | "observer";

export type CollaborationParticipant = {
  agentId: string;
  role: ParticipantRole;
  expertise?: string[];
  joinedAt: number;
  leftAt?: number;
  contributionCount: number;
};

export type CollaborationConfig = {
  /** Maximum number of response rounds */
  maxRounds?: number;
  /** Consensus threshold (0-1) for consensus mode */
  consensusThreshold?: number;
  /** Order of agents for chain-of-thought mode */
  chainOrder?: string[];
  /** Time limit per agent response (ms) */
  responseTimeout?: number;
  /** Whether to allow parallel responses */
  allowParallel?: boolean;
  /** Topic keywords for expert activation */
  topicKeywords?: Map<string, string[]>; // topic -> agentIds
  /** Auto-complete when goal is reached */
  autoComplete?: boolean;
};

export type CollaborationSession = {
  sessionId: string;
  channelId: string;
  mode: CollaborationMode;
  coordinator?: string;
  participants: CollaborationParticipant[];
  status: CollaborationStatus;
  config: CollaborationConfig;
  createdAt: number;
  updatedAt?: number;
  completedAt?: number;
  roundCount: number;
  metadata?: Record<string, unknown>;
};

export type CollaborationEvent =
  | { type: "session.started"; session: CollaborationSession }
  | { type: "session.paused"; sessionId: string; reason?: string }
  | { type: "session.resumed"; sessionId: string }
  | { type: "session.completed"; sessionId: string; result?: unknown }
  | { type: "session.cancelled"; sessionId: string; reason?: string }
  | { type: "participant.joined"; sessionId: string; participant: CollaborationParticipant }
  | { type: "participant.left"; sessionId: string; agentId: string }
  | { type: "round.started"; sessionId: string; roundNumber: number; activeAgents: string[] }
  | { type: "round.completed"; sessionId: string; roundNumber: number; responses: AgentResponse[] }
  | { type: "consensus.vote"; sessionId: string; agentId: string; vote: string }
  | { type: "consensus.reached"; sessionId: string; result: string; votes: Map<string, string> }
  | {
      type: "handoff.requested";
      sessionId: string;
      fromAgent: string;
      toAgent: string;
      context: string;
    }
  | { type: "handoff.accepted"; sessionId: string; toAgent: string }
  | { type: "expert.activated"; sessionId: string; agentId: string; topic: string };

export type AgentResponse = {
  agentId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

export type ConsensusVote = {
  agentId: string;
  vote: string;
  reasoning?: string;
  timestamp: number;
};

export type HandoffRequest = {
  fromAgent: string;
  toAgent: string;
  context: string;
  timestamp: number;
  accepted?: boolean;
};

export type ExpertActivation = {
  agentId: string;
  topic: string;
  confidence: number;
  timestamp: number;
};

// Mode-specific configurations
export type WarRoomConfig = CollaborationConfig & {
  mode: "war-room";
  /** All agents respond to each message */
  broadcastAll: boolean;
  /** Whether to aggregate responses */
  aggregateResponses: boolean;
};

export type ExpertPanelConfig = CollaborationConfig & {
  mode: "expert-panel";
  /** Mapping of expertise areas to agents */
  expertiseMapping: Map<string, string[]>;
  /** Confidence threshold for expert activation */
  activationThreshold: number;
  /** Allow fallback to any agent if no expert matches */
  allowFallback: boolean;
};

export type ChainConfig = CollaborationConfig & {
  mode: "chain-of-thought";
  /** Ordered list of agents in the chain */
  chainOrder: string[];
  /** Whether chain loops back to start */
  isLoop: boolean;
  /** Condition to break the chain early */
  breakCondition?: (response: AgentResponse) => boolean;
};

export type ConsensusConfig = CollaborationConfig & {
  mode: "consensus";
  /** Threshold for reaching consensus (0-1) */
  threshold: number;
  /** Maximum voting rounds */
  maxVotingRounds: number;
  /** Options for voting */
  voteOptions?: string[];
  /** Whether to require unanimous agreement */
  requireUnanimous: boolean;
};

export type CoordinatorConfig = CollaborationConfig & {
  mode: "coordinator";
  /** The coordinating agent */
  coordinatorId: string;
  /** Rules for routing */
  routingRules?: RoutingRule[];
  /** Whether coordinator can also respond */
  coordinatorCanRespond: boolean;
};

export type RoutingRule = {
  pattern: RegExp;
  targetAgents: string[];
  priority: number;
};

// Helper type for creating sessions
export type CreateSessionParams = {
  channelId: string;
  mode: CollaborationMode;
  coordinatorId?: string;
  participantIds: string[];
  config?: Partial<CollaborationConfig>;
};
