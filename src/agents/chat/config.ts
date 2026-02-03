/**
 * Configuration types and loader for multi-agent chat system.
 * Supports YAML configuration file for channel and agent settings.
 */

import type { CollaborationMode } from "./collaboration/types.js";
import type {
  AgentChannelType,
  AgentListeningMode,
  AgentChannelMemberRole,
} from "./types/channels.js";

/**
 * Root configuration structure for agent channels.
 */
export type AgentChannelsConfig = {
  enabled: boolean;

  /** Database configuration */
  database?: {
    postgres?: {
      host?: string;
      port?: number;
      database?: string;
      user?: string;
      password?: string;
      ssl?: boolean;
      maxConnections?: number;
    };
    redis?: {
      host?: string;
      port?: number;
      password?: string;
      db?: number;
      keyPrefix?: string;
      tls?: boolean;
    };
  };

  /** Auto-join settings for agents */
  autoJoin?: {
    /** Glob patterns for agent IDs to auto-join */
    agentPatterns?: string[];
    /** Default activation mode for auto-joined agents */
    defaultActivation?: {
      mode: AgentListeningMode;
      receiveBroadcasts?: boolean;
    };
    /** Channels to auto-join */
    channels?: string[];
  };

  /** Pre-configured channels */
  channels?: ChannelConfig[];

  /** Collaboration settings */
  collaboration?: {
    /** Default collaboration mode */
    defaultMode?: CollaborationMode;
    /** Expertise mapping for expert-panel mode */
    expertiseMapping?: Record<string, string[]>;
    /** Default config for each mode */
    modeDefaults?: {
      warRoom?: {
        broadcastAll?: boolean;
        aggregateResponses?: boolean;
      };
      expertPanel?: {
        activationThreshold?: number;
        allowFallback?: boolean;
      };
      chainOfThought?: {
        isLoop?: boolean;
      };
      consensus?: {
        threshold?: number;
        maxVotingRounds?: number;
        requireUnanimous?: boolean;
      };
    };
  };

  /** External platform bindings */
  bindings?: {
    slack?: ExternalBindingConfig;
    discord?: ExternalBindingConfig;
    telegram?: ExternalBindingConfig;
  };

  /** Presence settings */
  presence?: {
    /** TTL for presence in seconds */
    ttlSeconds?: number;
    /** Typing indicator TTL in seconds */
    typingTtlSeconds?: number;
    /** Heartbeat interval in seconds */
    heartbeatIntervalSeconds?: number;
  };

  /** Message settings */
  messages?: {
    /** Maximum message length */
    maxLength?: number;
    /** Default retention in days */
    retentionDays?: number;
    /** Enable full-text search */
    enableSearch?: boolean;
  };
};

export type ChannelConfig = {
  id: string;
  name: string;
  type: AgentChannelType;
  topic?: string;
  description?: string;
  defaultAgentId?: string;
  members?: ChannelMemberConfig[];
  settings?: {
    allowThreads?: boolean;
    allowReactions?: boolean;
    retentionDays?: number;
    maxMessageLength?: number;
    slowModeSeconds?: number;
  };
};

export type ChannelMemberConfig = {
  agentId: string;
  role?: AgentChannelMemberRole;
  listeningMode?: AgentListeningMode;
  receiveBroadcasts?: boolean;
  customName?: string;
};

export type ExternalBindingConfig = {
  enabled?: boolean;
  accountId?: string;
  channels?: {
    externalId: string;
    agentChannelId: string;
    direction?: "inbound" | "outbound" | "bidirectional";
    syncMessages?: boolean;
    syncThreads?: boolean;
    syncReactions?: boolean;
  }[];
};

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: AgentChannelsConfig = {
  enabled: true,
  database: {
    postgres: {
      host: "localhost",
      port: 5432,
      database: "openclaw_chat",
      maxConnections: 20,
    },
    redis: {
      host: "localhost",
      port: 6379,
      db: 0,
      keyPrefix: "chat:",
    },
  },
  autoJoin: {
    agentPatterns: ["*"],
    defaultActivation: {
      mode: "mention-only",
      receiveBroadcasts: true,
    },
  },
  presence: {
    ttlSeconds: 300, // 5 minutes
    typingTtlSeconds: 10,
    heartbeatIntervalSeconds: 60,
  },
  messages: {
    maxLength: 10000,
    retentionDays: 365,
    enableSearch: true,
  },
};

/**
 * Example YAML configuration content.
 */
export const EXAMPLE_CONFIG_YAML = `# OpenClaw Multi-Agent Chat Configuration
# Place this in your openclaw.yaml or as a separate agent-channels.yaml

agentChannels:
  enabled: true

  # Database configuration (uses main database credentials by default)
  database:
    postgres:
      host: localhost
      port: 5432
      database: openclaw_chat
      # user and password inherited from main config
      ssl: false
      maxConnections: 20

    redis:
      host: localhost
      port: 6379
      db: 0
      keyPrefix: "chat:"

  # Auto-join settings
  autoJoin:
    # Which agents should auto-join channels
    agentPatterns:
      - "*"  # All agents

    # Default settings for auto-joined agents
    defaultActivation:
      mode: mention-only  # active | mention-only | observer | coordinator
      receiveBroadcasts: true

    # Channels to auto-join
    channels:
      - general

  # Pre-configured channels
  channels:
    - id: general
      name: General
      type: public
      topic: "General discussion and questions"
      defaultAgentId: main  # Agent that responds without @mention
      members:
        - agentId: main
          role: admin
          listeningMode: active
        - agentId: coder
          role: member
          listeningMode: mention-only
        - agentId: reviewer
          role: member
          listeningMode: mention-only
      settings:
        allowThreads: true
        allowReactions: true
        retentionDays: 365

    - id: coding
      name: Coding Help
      type: public
      topic: "Get help with code"
      defaultAgentId: coder
      members:
        - agentId: coder
          role: admin
          listeningMode: active
          customName: "Code Assistant"
        - agentId: reviewer
          role: member
          listeningMode: mention-only
          customName: "Code Reviewer"

    - id: research
      name: Research
      type: private
      topic: "Research and exploration"
      members:
        - agentId: researcher
          role: admin
          listeningMode: active

  # Collaboration settings
  collaboration:
    defaultMode: expert-panel

    # Map topics to expert agents
    expertiseMapping:
      code:
        - coder
        - reviewer
      research:
        - researcher
      design:
        - designer

    modeDefaults:
      warRoom:
        broadcastAll: true
        aggregateResponses: false
      expertPanel:
        activationThreshold: 0.5
        allowFallback: true
      chainOfThought:
        isLoop: false
      consensus:
        threshold: 0.66
        maxVotingRounds: 3
        requireUnanimous: false

  # External platform bindings
  bindings:
    slack:
      enabled: false
      accountId: ""
      channels: []

    discord:
      enabled: false
      accountId: ""
      channels: []

    telegram:
      enabled: false
      accountId: ""
      channels: []

  # Presence settings
  presence:
    ttlSeconds: 300
    typingTtlSeconds: 10
    heartbeatIntervalSeconds: 60

  # Message settings
  messages:
    maxLength: 10000
    retentionDays: 365
    enableSearch: true
`;

/**
 * Merge user config with defaults.
 */
export function mergeConfig(userConfig: Partial<AgentChannelsConfig>): AgentChannelsConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    database: {
      postgres: {
        ...DEFAULT_CONFIG.database?.postgres,
        ...userConfig.database?.postgres,
      },
      redis: {
        ...DEFAULT_CONFIG.database?.redis,
        ...userConfig.database?.redis,
      },
    },
    autoJoin: {
      ...DEFAULT_CONFIG.autoJoin,
      ...userConfig.autoJoin,
      defaultActivation: {
        ...DEFAULT_CONFIG.autoJoin?.defaultActivation,
        ...userConfig.autoJoin?.defaultActivation,
      },
    },
    presence: {
      ...DEFAULT_CONFIG.presence,
      ...userConfig.presence,
    },
    messages: {
      ...DEFAULT_CONFIG.messages,
      ...userConfig.messages,
    },
  };
}

/**
 * Validate configuration.
 */
export function validateConfig(config: AgentChannelsConfig): string[] {
  const errors: string[] = [];

  if (config.channels) {
    const channelIds = new Set<string>();
    for (const channel of config.channels) {
      if (!channel.id) {
        errors.push("Channel missing required 'id' field");
      } else if (channelIds.has(channel.id)) {
        errors.push(`Duplicate channel ID: ${channel.id}`);
      } else {
        channelIds.add(channel.id);
      }

      if (!channel.name) {
        errors.push(`Channel ${channel.id} missing required 'name' field`);
      }

      if (!channel.type || !["public", "private", "dm", "broadcast"].includes(channel.type)) {
        errors.push(`Channel ${channel.id} has invalid type: ${channel.type}`);
      }

      if (channel.members) {
        const memberIds = new Set<string>();
        for (const member of channel.members) {
          if (!member.agentId) {
            errors.push(`Channel ${channel.id} has member without agentId`);
          } else if (memberIds.has(member.agentId)) {
            errors.push(`Channel ${channel.id} has duplicate member: ${member.agentId}`);
          } else {
            memberIds.add(member.agentId);
          }

          if (member.role && !["owner", "admin", "member", "observer"].includes(member.role)) {
            errors.push(
              `Channel ${channel.id} member ${member.agentId} has invalid role: ${member.role}`,
            );
          }

          if (
            member.listeningMode &&
            !["active", "mention-only", "observer", "coordinator"].includes(member.listeningMode)
          ) {
            errors.push(
              `Channel ${channel.id} member ${member.agentId} has invalid listeningMode: ${member.listeningMode}`,
            );
          }
        }
      }
    }
  }

  if (config.collaboration?.expertiseMapping) {
    for (const [topic, agents] of Object.entries(config.collaboration.expertiseMapping)) {
      if (!Array.isArray(agents)) {
        errors.push(`Expertise mapping for '${topic}' must be an array of agent IDs`);
      }
    }
  }

  return errors;
}
