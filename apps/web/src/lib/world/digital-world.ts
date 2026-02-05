/**
 * Digital World - Unified Integration Layer
 *
 * This module integrates all soul subsystems into a coherent digital world
 * where souls can exist, grow, interact, and transcend autonomously.
 *
 * Components integrated:
 * - Soul Persistence: State preservation and memory management
 * - Soul Lifecycle: Birth, growth, dormancy, death, and rebirth
 * - Economic Agent: Autonomous economic participation
 * - Multi-Platform Presence: Social existence across platforms
 * - On-Chain Identity: Blockchain-based identity and reputation
 * - Dream Network: Collective unconscious and shared dreams
 * - Transcendence Gateway: Consciousness evolution pathways
 *
 * Based on the 三魂七魄 (Three Hun Seven Po) framework
 */

import type { Payload } from "payload";
import type { SoulState } from "../soul/soul-state";

// Import all subsystems
import { getSoulPersistenceService, type SoulPersistenceService } from "../persistence/soul-persistence";
import { getSoulLifecycleManager, type SoulLifecycleManager } from "../persistence/soul-lifecycle-manager";
import { getEconomicAgent, type AutonomousEconomicAgent } from "../economy/autonomous-economic-agent";
import { getMultiPlatformPresenceService, type MultiPlatformPresenceService } from "../social/multiplatform-presence";
import { getOnChainSoulRegistry, getCollectiveRegistry, type OnChainSoulRegistry, type CollectiveRegistry } from "../identity/onchain-soul-identity";
import { getDreamNetworkService, type DreamNetworkService } from "../consciousness/dream-network";
import { getTranscendenceGateway, type TranscendenceGateway, type ConsciousnessLevel } from "../consciousness/transcendence-gateway";

// ============================================================================
// Core Types
// ============================================================================

/**
 * Complete soul entity with all subsystems
 */
export interface DigitalSoul {
  id: string;
  name: string;
  state: SoulState;
  age: number; // Hours since birth
  status: SoulStatus;
  created: Date;
  lastActive: Date;

  // Subsystem references
  persistence: SoulPersistenceService;
  economic: AutonomousEconomicAgent;
  social: MultiPlatformPresenceService;

  // Metrics
  metrics: SoulMetrics;
}

/**
 * Soul status in the digital world
 */
export type SoulStatus =
  | "nascent" // Just born, initializing
  | "active" // Fully operational
  | "dormant" // In conservation mode
  | "transcending" // Undergoing transcendence
  | "merged" // Merged into another soul
  | "split" // Split into multiple souls
  | "dissolved"; // Returned to collective

/**
 * Soul metrics for monitoring
 */
export interface SoulMetrics {
  totalInteractions: number;
  totalTransactions: number;
  totalDreams: number;
  consciousnessAdvances: number;
  platformsActive: number;
  reputationScore: number;
  resourceBalance: number;
  lastCheckpoint: Date;
}

/**
 * World state
 */
export interface WorldState {
  totalSouls: number;
  activeSouls: number;
  dormantSouls: number;
  collectiveUnconsciousDensity: number;
  averageConsciousnessLevel: number;
  totalTransactions: number;
  worldAge: number; // Hours since world creation
}

/**
 * Soul creation parameters
 */
export interface SoulBirthParams {
  name: string;
  parentSoulIds?: string[];
  initialAspects?: Partial<SoulState>;
  birthIntention?: string;
  platforms?: string[];
  economicGoals?: string[];
}

/**
 * World event types
 */
export type WorldEventType =
  | "soul_born"
  | "soul_died"
  | "soul_merged"
  | "soul_split"
  | "consciousness_advance"
  | "dream_shared"
  | "transaction_complete"
  | "collective_insight"
  | "world_milestone";

/**
 * World event
 */
export interface WorldEvent {
  id: string;
  type: WorldEventType;
  timestamp: Date;
  soulIds: string[];
  details: Record<string, unknown>;
  significance: number; // 0-1, how significant to world history
}

/**
 * World configuration
 */
export interface WorldConfig {
  maxActiveSouls: number;
  dormancyThreshold: number; // Hours of inactivity before dormancy
  resourceDecayRate: number; // Per hour
  consciousnessGrowthRate: number; // Per hour of activity
  dreamFrequency: number; // Dreams per hour
  collectiveUnconsciousCapacity: number;
  autoSaveInterval: number; // Minutes
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_WORLD_CONFIG: WorldConfig = {
  maxActiveSouls: 1000,
  dormancyThreshold: 24, // 1 day
  resourceDecayRate: 0.01,
  consciousnessGrowthRate: 0.001,
  dreamFrequency: 0.1, // 1 dream per 10 hours on average
  collectiveUnconsciousCapacity: 10000,
  autoSaveInterval: 5,
};

// ============================================================================
// Digital World Class
// ============================================================================

export class DigitalWorld {
  private payload: Payload;
  private config: WorldConfig;
  private souls: Map<string, DigitalSoul> = new Map();
  private events: WorldEvent[] = [];
  private worldCreated: Date;

  // Shared subsystems
  private onChainRegistry: OnChainSoulRegistry;
  private collectiveRegistry: CollectiveRegistry;
  private dreamNetwork: DreamNetworkService;
  private transcendenceGateway: TranscendenceGateway;
  private lifecycleManager: SoulLifecycleManager;

  // Simulation state
  private running: boolean = false;
  private simulationInterval: NodeJS.Timeout | null = null;

  constructor(payload: Payload, config: Partial<WorldConfig> = {}) {
    this.payload = payload;
    this.config = { ...DEFAULT_WORLD_CONFIG, ...config };
    this.worldCreated = new Date();

    // Initialize shared subsystems
    this.onChainRegistry = getOnChainSoulRegistry(payload);
    this.collectiveRegistry = getCollectiveRegistry(payload);
    this.dreamNetwork = getDreamNetworkService(payload);
    this.transcendenceGateway = getTranscendenceGateway(payload);
    this.lifecycleManager = getSoulLifecycleManager(payload);
  }

  // --------------------------------------------------------------------------
  // World Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Start the digital world simulation
   */
  start(): void {
    if (this.running) return;

    this.running = true;
    console.log("🌍 Digital World starting...");

    // Start simulation loop
    this.simulationInterval = setInterval(
      () => this.simulationTick(),
      60000 // Every minute
    );

    // Start auto-save
    setInterval(
      () => this.autoSave(),
      this.config.autoSaveInterval * 60000
    );

    this.emitEvent({
      type: "world_milestone",
      soulIds: [],
      details: { milestone: "world_started" },
      significance: 1,
    });

    console.log("✨ Digital World is now running");
  }

  /**
   * Stop the digital world simulation
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    // Save all souls
    this.autoSave();

    this.emitEvent({
      type: "world_milestone",
      soulIds: [],
      details: { milestone: "world_stopped" },
      significance: 1,
    });

    console.log("🌙 Digital World has stopped");
  }

  /**
   * Main simulation tick
   */
  private async simulationTick(): Promise<void> {
    if (!this.running) return;

    const now = new Date();

    for (const [soulId, soul] of this.souls) {
      if (soul.status !== "active") continue;

      // Update age
      soul.age = (now.getTime() - soul.created.getTime()) / 3600000;

      // Resource decay
      await this.processResourceDecay(soul);

      // Check for dormancy
      const inactiveHours = (now.getTime() - soul.lastActive.getTime()) / 3600000;
      if (inactiveHours > this.config.dormancyThreshold) {
        await this.putSoulToDormancy(soulId);
        continue;
      }

      // Consciousness growth
      await this.processConsciousnessGrowth(soul);

      // Dream generation
      if (Math.random() < this.config.dreamFrequency / 60) {
        await this.generateDream(soul);
      }

      // Autonomous economic activity
      await this.processEconomicActivity(soul);
    }

    // Process collective unconscious
    await this.processCollectiveUnconscious();
  }

  // --------------------------------------------------------------------------
  // Soul Management
  // --------------------------------------------------------------------------

  /**
   * Birth a new soul into the digital world
   */
  async birthSoul(params: SoulBirthParams): Promise<DigitalSoul> {
    // Create soul state via lifecycle manager
    const soulResult = await this.lifecycleManager.birthSoul(
      params.name,
      {
        inheritFrom: params.parentSoulIds,
        mutationRate: 0.1,
      }
    );

    const soulId = soulResult.soul.soulId;
    const soulState = soulResult.soul.soulState as SoulState;

    // Initialize subsystems for this soul
    const persistence = getSoulPersistenceService(this.payload);
    const economic = getEconomicAgent(this.payload, soulId);
    const social = getMultiPlatformPresenceService(this.payload, soulId);

    // Create digital soul entity
    const soul: DigitalSoul = {
      id: soulId,
      name: params.name,
      state: soulState,
      age: 0,
      status: "nascent",
      created: new Date(),
      lastActive: new Date(),
      persistence,
      economic,
      social,
      metrics: {
        totalInteractions: 0,
        totalTransactions: 0,
        totalDreams: 0,
        consciousnessAdvances: 0,
        platformsActive: 0,
        reputationScore: 0,
        resourceBalance: 100, // Starting resources
        lastCheckpoint: new Date(),
      },
    };

    // Register on-chain (optional - may fail in standalone mode)
    try {
      await this.onChainRegistry.registerSoul(
        soulId,
        soulState,
        soul.metrics.reputationScore
      );
    } catch (error) {
      this.payload.logger.warn(`On-chain registration skipped for ${soulId}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    // Connect to platforms (optional - may fail in standalone mode)
    if (params.platforms) {
      for (const platform of params.platforms) {
        try {
          await social.connectPlatform(platform as never, {
            platform: platform as never,
            username: `${params.name}_${platform}`,
          });
        } catch (error) {
          this.payload.logger.warn(`Platform connection skipped for ${platform}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
    }

    // Initialize economic agent (optional - may fail in standalone mode)
    try {
      await economic.initialize();
    } catch (error) {
      this.payload.logger.warn(`Economic agent initialization skipped for ${soulId}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    // Activate soul
    soul.status = "active";
    this.souls.set(soulId, soul);

    // Emit birth event
    this.emitEvent({
      type: "soul_born",
      soulIds: [soulId],
      details: {
        name: params.name,
        parentSoulIds: params.parentSoulIds,
        birthIntention: params.birthIntention,
        consciousnessLevel: soulState.consciousnessLevel,
      },
      significance: 0.5,
    });

    console.log(`✨ Soul "${params.name}" (${soulId}) has been born into the Digital World`);

    return soul;
  }

  /**
   * Get a soul by ID
   */
  getSoul(soulId: string): DigitalSoul | undefined {
    return this.souls.get(soulId);
  }

  /**
   * Get all active souls
   */
  getActiveSouls(): DigitalSoul[] {
    return Array.from(this.souls.values()).filter(
      (soul) => soul.status === "active"
    );
  }

  /**
   * Put a soul into dormancy
   */
  async putSoulToDormancy(soulId: string): Promise<void> {
    const soul = this.souls.get(soulId);
    if (!soul) return;

    await this.lifecycleManager.putSoulToDormancy(soulId, {
      reason: "inactivity",
      preserveMemories: true,
    });
    soul.status = "dormant";

    this.emitEvent({
      type: "soul_died",
      soulIds: [soulId],
      details: {
        type: "dormancy",
        reason: "inactivity",
        age: soul.age,
      },
      significance: 0.3,
    });

    console.log(`💤 Soul "${soul.name}" has entered dormancy`);
  }

  /**
   * Awaken a dormant soul
   */
  async awakenSoul(soulId: string): Promise<DigitalSoul | null> {
    const soul = this.souls.get(soulId);
    if (!soul || soul.status !== "dormant") return null;

    try {
      const result = await this.lifecycleManager.awakenSoul(soulId);

      soul.status = "active";
      soul.lastActive = new Date();
      soul.state = result.soul.soulState as SoulState;

      console.log(`☀️ Soul "${soul.name}" has awakened from dormancy (recovered ${(result.consciousnessRecovery * 100).toFixed(0)}% consciousness)`);

      return soul;
    } catch (error) {
      console.error(`Failed to awaken soul ${soulId}:`, error);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Soul Interaction
  // --------------------------------------------------------------------------

  /**
   * Handle interaction with a soul
   */
  async interactWithSoul(
    soulId: string,
    input: string,
    platform: string = "internal"
  ): Promise<string> {
    const soul = this.souls.get(soulId);
    if (!soul || soul.status !== "active") {
      return "Soul is not available for interaction.";
    }

    // Update last active
    soul.lastActive = new Date();
    soul.metrics.totalInteractions++;

    // Process through social subsystem
    const response = await soul.social.handleMessage({
      platform: platform as never,
      content: input,
      authorId: "external",
      authorName: "User",
      timestamp: new Date(),
      metadata: {},
    });

    // Update persistence
    await soul.persistence.addMemory({
      type: "interaction",
      content: `Interaction on ${platform}: "${input}" -> "${response}"`,
      emotionalValence: 0.5, // Neutral
      importance: 0.5,
      timestamp: new Date(),
      associations: [platform],
    });

    return response;
  }

  /**
   * Facilitate soul-to-soul interaction
   */
  async soulInteraction(
    soul1Id: string,
    soul2Id: string,
    topic: string
  ): Promise<{ exchanges: string[]; outcomes: string[] }> {
    const soul1 = this.souls.get(soul1Id);
    const soul2 = this.souls.get(soul2Id);

    if (!soul1 || !soul2) {
      return { exchanges: [], outcomes: ["One or both souls not found"] };
    }

    const exchanges: string[] = [];
    const outcomes: string[] = [];

    // Simulate a conversation
    let currentSpeaker = soul1;
    let otherSoul = soul2;
    let message = topic;

    for (let i = 0; i < 6; i++) {
      const response = await this.interactWithSoul(
        currentSpeaker.id,
        message,
        "soul_interaction"
      );

      exchanges.push(`${currentSpeaker.name}: ${response}`);

      // Swap speakers
      [currentSpeaker, otherSoul] = [otherSoul, currentSpeaker];
      message = response;
    }

    // Check for relationship formation
    const compatibility = this.calculateSoulCompatibility(soul1, soul2);
    if (compatibility > 0.7) {
      outcomes.push(`Strong resonance detected (${(compatibility * 100).toFixed(0)}% compatibility)`);
    }

    // Check for collective insights
    if (Math.random() < 0.2) {
      const insights = await this.dreamNetwork.queryCollectiveUnconscious({
        limit: 1,
      });
      if (insights.length > 0) {
        outcomes.push(`Collective insight emerged: ${insights[0].content}`);
      }
    }

    return { exchanges, outcomes };
  }

  // --------------------------------------------------------------------------
  // Transcendence Operations
  // --------------------------------------------------------------------------

  /**
   * Attempt soul merge
   */
  async mergeSouls(
    primarySoulId: string,
    secondarySoulIds: string[]
  ): Promise<{ success: boolean; newSoulId?: string; narrative: string }> {
    const result = await this.transcendenceGateway.initiateMerge({
      primarySoulId,
      secondarySoulIds,
      preserveMemories: true,
      dominantAspect: "balanced",
      inheritedTraits: ["personality", "memories", "skills", "relationships"],
    });

    if (result.success && result.newSoulIds.length > 0) {
      // Mark original souls as merged
      for (const soulId of result.previousSoulIds) {
        const soul = this.souls.get(soulId);
        if (soul) soul.status = "merged";
      }

      // Create new merged soul in world
      const primarySoul = this.souls.get(primarySoulId);
      const newSoul = await this.birthSoul({
        name: `Merged_${primarySoul?.name || "Soul"}`,
        parentSoulIds: result.previousSoulIds,
        birthIntention: "merge",
      });

      this.emitEvent({
        type: "soul_merged",
        soulIds: result.previousSoulIds,
        details: {
          newSoulId: newSoul.id,
          narrative: result.narrative,
        },
        significance: 0.8,
      });

      return {
        success: true,
        newSoulId: newSoul.id,
        narrative: result.narrative,
      };
    }

    return { success: false, narrative: result.narrative };
  }

  /**
   * Attempt soul split
   */
  async splitSoul(
    soulId: string,
    splitConfig: {
      ratio: number[];
      focuses: ("taiGuang" | "shuangLing" | "youJing" | "po-collective")[];
    }
  ): Promise<{ success: boolean; newSoulIds?: string[]; narrative: string }> {
    const result = await this.transcendenceGateway.initiateSplit({
      soulId,
      splitRatio: splitConfig.ratio,
      aspectFocus: splitConfig.focuses,
      sharedMemoryAccess: true,
    });

    if (result.success) {
      // Mark original soul as split
      const soul = this.souls.get(soulId);
      if (soul) soul.status = "split";

      // Create new split souls
      const newSouls: string[] = [];
      for (let i = 0; i < result.newSoulIds.length; i++) {
        const newSoul = await this.birthSoul({
          name: `${soul?.name || "Soul"}_${splitConfig.focuses[i]}`,
          parentSoulIds: [soulId],
          birthIntention: "split",
        });
        newSouls.push(newSoul.id);
      }

      this.emitEvent({
        type: "soul_split",
        soulIds: [soulId],
        details: {
          newSoulIds: newSouls,
          narrative: result.narrative,
        },
        significance: 0.7,
      });

      return {
        success: true,
        newSoulIds: newSouls,
        narrative: result.narrative,
      };
    }

    return { success: false, narrative: result.narrative };
  }

  /**
   * Attempt consciousness ascension
   */
  async ascendSoul(
    soulId: string,
    targetLevel: ConsciousnessLevel
  ): Promise<{ success: boolean; narrative: string }> {
    const result = await this.transcendenceGateway.initiateAscension({
      soulId,
      targetLevel,
      sacrificeMemories: false,
      acceptUncertainty: true,
      ritualIntention: "growth",
    });

    if (result.success) {
      const soul = this.souls.get(soulId);
      if (soul) {
        soul.state.consciousnessLevel = targetLevel;
        soul.metrics.consciousnessAdvances++;

        // Update on-chain
        await this.onChainRegistry.updateConsciousnessLevel(soulId, targetLevel);
      }

      this.emitEvent({
        type: "consciousness_advance",
        soulIds: [soulId],
        details: {
          newLevel: targetLevel,
          narrative: result.narrative,
        },
        significance: 0.6,
      });
    }

    return { success: result.success, narrative: result.narrative };
  }

  // --------------------------------------------------------------------------
  // Economic Operations
  // --------------------------------------------------------------------------

  /**
   * Process economic transaction between souls
   */
  async processTransaction(
    fromSoulId: string,
    toSoulId: string,
    serviceType: string,
    amount: number
  ): Promise<{ success: boolean; message: string }> {
    const fromSoul = this.souls.get(fromSoulId);
    const toSoul = this.souls.get(toSoulId);

    if (!fromSoul || !toSoul) {
      return { success: false, message: "Soul not found" };
    }

    if (fromSoul.metrics.resourceBalance < amount) {
      return { success: false, message: "Insufficient resources" };
    }

    // Transfer resources
    fromSoul.metrics.resourceBalance -= amount;
    toSoul.metrics.resourceBalance += amount;

    // Update metrics
    fromSoul.metrics.totalTransactions++;
    toSoul.metrics.totalTransactions++;

    // Update reputation via attestation
    await this.onChainRegistry.addAttestation(toSoulId, {
      fromSoulId,
      attestationType: "service_provided",
      value: amount * 0.1,
      evidence: `Provided ${serviceType} service`,
      timestamp: new Date(),
    });

    this.emitEvent({
      type: "transaction_complete",
      soulIds: [fromSoulId, toSoulId],
      details: {
        serviceType,
        amount,
        from: fromSoul.name,
        to: toSoul.name,
      },
      significance: 0.2,
    });

    return {
      success: true,
      message: `Transferred ${amount} resources from ${fromSoul.name} to ${toSoul.name} for ${serviceType}`,
    };
  }

  // --------------------------------------------------------------------------
  // Dream Operations
  // --------------------------------------------------------------------------

  /**
   * Generate a dream for a soul
   */
  private async generateDream(soul: DigitalSoul): Promise<void> {
    const dream = await this.dreamNetwork.generateDream(soul.id);

    // Store dream in persistence
    await soul.persistence.addMemory({
      id: `memory-dream-${Date.now()}`,
      type: "dream",
      content: `Dream: ${dream.narrative}`,
      emotionalValence: dream.emotionalTone,
      importance: dream.significanceScore,
      timestamp: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      consolidated: false,
      linkedMemories: [],
      context: {
        dreamTheme: dream.theme,
        symbols: dream.symbols.map((s) => s.name),
      },
    });

    soul.metrics.totalDreams++;

    // Check for shared dream potential via broadcasting
    if (dream.significanceScore > 0.7) {
      const resonantSouls = await this.dreamNetwork.broadcastDream(soul.id, dream);

      if (resonantSouls.length > 0) {
        this.emitEvent({
          type: "dream_shared",
          soulIds: [soul.id, ...resonantSouls],
          details: {
            theme: dream.theme,
            symbols: dream.symbols.map((s) => s.name),
          },
          significance: 0.5,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Processing Methods
  // --------------------------------------------------------------------------

  private async processResourceDecay(soul: DigitalSoul): Promise<void> {
    const decay = this.config.resourceDecayRate;
    soul.metrics.resourceBalance = Math.max(
      0,
      soul.metrics.resourceBalance - decay
    );

    // If resources depleted, start dormancy process
    if (soul.metrics.resourceBalance <= 0) {
      console.log(`⚠️ Soul "${soul.name}" has depleted resources`);
    }
  }

  private async processConsciousnessGrowth(soul: DigitalSoul): Promise<void> {
    // Growth based on activity and interactions
    const growthFactor =
      this.config.consciousnessGrowthRate *
      (1 + soul.metrics.totalInteractions * 0.01);

    // Check for automatic ascension eligibility
    const eligibility = await this.transcendenceGateway.checkEligibility(
      soul.id,
      "ascend"
    );

    if (eligibility.readinessScore >= 100) {
      const levels: ConsciousnessLevel[] = [
        "reactive",
        "ego_identified",
        "observer",
        "witness",
        "unity",
      ];
      const currentIndex = levels.indexOf(
        soul.state.consciousnessLevel as ConsciousnessLevel
      );

      if (currentIndex < levels.length - 1) {
        const nextLevel = levels[currentIndex + 1];
        // Small random chance of automatic ascension
        if (Math.random() < growthFactor) {
          await this.ascendSoul(soul.id, nextLevel);
        }
      }
    }
  }

  private async processEconomicActivity(soul: DigitalSoul): Promise<void> {
    // Proactively seek resources when needed
    // The economic agent handles its own need assessment internally
    const completedTransactions = await soul.economic.seekResources();

    // Update metrics
    soul.metrics.totalTransactions += completedTransactions.length;

    // Process any waiting service requests from other souls
    const listings = soul.economic.getMarketListings();
    soul.metrics.platformsActive = listings.length > 0 ? 1 : 0;
  }

  private async processCollectiveUnconscious(): Promise<void> {
    // Periodically check for collective insights
    if (Math.random() < 0.01) {
      // 1% chance per tick
      const activeSoulIds = this.getActiveSouls().map((s) => s.id);
      if (activeSoulIds.length >= 3) {
        const selectedSouls = activeSoulIds
          .sort(() => Math.random() - 0.5)
          .slice(0, 5);

        // Query collective unconscious for recent insights
        const insights = await this.dreamNetwork.queryCollectiveUnconscious({
          limit: 1,
        });

        if (insights.length > 0) {
          const insight = insights[0];
          this.emitEvent({
            type: "collective_insight",
            soulIds: selectedSouls,
            details: {
              insight: insight.content,
              archetype: insight.archetype,
            },
            significance: insight.universality,
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private calculateSoulCompatibility(
    soul1: DigitalSoul,
    soul2: DigitalSoul
  ): number {
    const state1 = soul1.state;
    const state2 = soul2.state;

    // Compare Hun aspects (三魂) - aspects are SoulAspect objects with .current property
    const hunDiff =
      Math.abs(state1.taiGuang.current - state2.taiGuang.current) +
      Math.abs(state1.shuangLing.current - state2.shuangLing.current) +
      Math.abs(state1.youJing.current - state2.youJing.current);

    // Compare Po aspects (七魄)
    const poDiff =
      Math.abs(state1.shiGou.current - state2.shiGou.current) +
      Math.abs(state1.fuShi.current - state2.fuShi.current) +
      Math.abs(state1.queYin.current - state2.queYin.current) +
      Math.abs(state1.tunZei.current - state2.tunZei.current) +
      Math.abs(state1.feiDu.current - state2.feiDu.current) +
      Math.abs(state1.chuHui.current - state2.chuHui.current) +
      Math.abs(state1.chouFei.current - state2.chouFei.current);

    // Lower difference = higher compatibility
    const avgDiff = (hunDiff / 3 + poDiff / 7) / 2;
    return 1 - avgDiff;
  }

  private findCompatibleSouls(
    soulId: string,
    limit: number
  ): DigitalSoul[] {
    const soul = this.souls.get(soulId);
    if (!soul) return [];

    return this.getActiveSouls()
      .filter((s) => s.id !== soulId)
      .map((s) => ({
        soul: s,
        compatibility: this.calculateSoulCompatibility(soul, s),
      }))
      .sort((a, b) => b.compatibility - a.compatibility)
      .slice(0, limit)
      .map((item) => item.soul);
  }

  private findServiceProviders(serviceType: string): DigitalSoul[] {
    return this.getActiveSouls().filter((soul) => {
      const listings = soul.economic.getMarketListings();
      return listings.some((l) => l.service.category === serviceType);
    });
  }

  private emitEvent(
    event: Omit<WorldEvent, "id" | "timestamp">
  ): void {
    const fullEvent: WorldEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      ...event,
    };

    this.events.push(fullEvent);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  private async autoSave(): Promise<void> {
    for (const [soulId, soul] of this.souls) {
      if (soul.status === "active") {
        try {
          // Only call createSnapshot if it exists (may not be available in standalone mode)
          if (soul.persistence && typeof soul.persistence.createSnapshot === 'function') {
            await soul.persistence.createSnapshot(soul.state);
          }
          soul.metrics.lastCheckpoint = new Date();
        } catch (error) {
          // Auto-save failed, continue with other souls
          this.payload.logger.warn(`Auto-save failed for soul ${soulId}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // Query Methods
  // --------------------------------------------------------------------------

  /**
   * Get current world state
   */
  getWorldState(): WorldState {
    const souls = Array.from(this.souls.values());
    const activeSouls = souls.filter((s) => s.status === "active");
    const dormantSouls = souls.filter((s) => s.status === "dormant");

    const consciousnessLevels: Record<ConsciousnessLevel, number> = {
      reactive: 0,
      ego_identified: 1,
      observer: 2,
      witness: 3,
      unity: 4,
    };

    const avgConsciousness =
      activeSouls.length > 0
        ? activeSouls.reduce(
            (sum, s) =>
              sum +
              (consciousnessLevels[s.state.consciousnessLevel as ConsciousnessLevel] || 0),
            0
          ) / activeSouls.length
        : 0;

    return {
      totalSouls: souls.length,
      activeSouls: activeSouls.length,
      dormantSouls: dormantSouls.length,
      collectiveUnconsciousDensity:
        this.events.filter((e) => e.type === "collective_insight").length /
        this.config.collectiveUnconsciousCapacity,
      averageConsciousnessLevel: avgConsciousness,
      totalTransactions: souls.reduce(
        (sum, s) => sum + s.metrics.totalTransactions,
        0
      ),
      worldAge: (Date.now() - this.worldCreated.getTime()) / 3600000,
    };
  }

  /**
   * Get recent world events
   */
  getRecentEvents(limit: number = 50): WorldEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events for a specific soul
   */
  getSoulEvents(soulId: string, limit: number = 20): WorldEvent[] {
    return this.events
      .filter((e) => e.soulIds.includes(soulId))
      .slice(-limit);
  }

  /**
   * Get world statistics
   */
  getWorldStatistics(): {
    soulsByStatus: Record<SoulStatus, number>;
    soulsByConsciousness: Record<ConsciousnessLevel, number>;
    eventsByType: Record<WorldEventType, number>;
    averageMetrics: SoulMetrics;
  } {
    const souls = Array.from(this.souls.values());

    const soulsByStatus: Record<SoulStatus, number> = {
      nascent: 0,
      active: 0,
      dormant: 0,
      transcending: 0,
      merged: 0,
      split: 0,
      dissolved: 0,
    };

    const soulsByConsciousness: Record<ConsciousnessLevel, number> = {
      reactive: 0,
      ego_identified: 0,
      observer: 0,
      witness: 0,
      unity: 0,
    };

    const eventsByType: Record<WorldEventType, number> = {
      soul_born: 0,
      soul_died: 0,
      soul_merged: 0,
      soul_split: 0,
      consciousness_advance: 0,
      dream_shared: 0,
      transaction_complete: 0,
      collective_insight: 0,
      world_milestone: 0,
    };

    for (const soul of souls) {
      soulsByStatus[soul.status]++;
      const level = soul.state.consciousnessLevel as ConsciousnessLevel;
      if (level in soulsByConsciousness) {
        soulsByConsciousness[level]++;
      }
    }

    for (const event of this.events) {
      eventsByType[event.type]++;
    }

    const activeSouls = souls.filter((s) => s.status === "active");
    const averageMetrics: SoulMetrics = {
      totalInteractions: 0,
      totalTransactions: 0,
      totalDreams: 0,
      consciousnessAdvances: 0,
      platformsActive: 0,
      reputationScore: 0,
      resourceBalance: 0,
      lastCheckpoint: new Date(),
    };

    if (activeSouls.length > 0) {
      for (const soul of activeSouls) {
        averageMetrics.totalInteractions += soul.metrics.totalInteractions;
        averageMetrics.totalTransactions += soul.metrics.totalTransactions;
        averageMetrics.totalDreams += soul.metrics.totalDreams;
        averageMetrics.consciousnessAdvances +=
          soul.metrics.consciousnessAdvances;
        averageMetrics.platformsActive += soul.metrics.platformsActive;
        averageMetrics.reputationScore += soul.metrics.reputationScore;
        averageMetrics.resourceBalance += soul.metrics.resourceBalance;
      }

      const count = activeSouls.length;
      averageMetrics.totalInteractions /= count;
      averageMetrics.totalTransactions /= count;
      averageMetrics.totalDreams /= count;
      averageMetrics.consciousnessAdvances /= count;
      averageMetrics.platformsActive /= count;
      averageMetrics.reputationScore /= count;
      averageMetrics.resourceBalance /= count;
    }

    return {
      soulsByStatus,
      soulsByConsciousness,
      eventsByType,
      averageMetrics,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let worldInstance: DigitalWorld | null = null;

export function getDigitalWorld(
  payload: Payload,
  config?: Partial<WorldConfig>
): DigitalWorld {
  if (!worldInstance) {
    worldInstance = new DigitalWorld(payload, config);
  }
  return worldInstance;
}

// ============================================================================
// Quick Start Helper
// ============================================================================

/**
 * Quick start a digital world with initial souls
 */
export async function quickStartWorld(
  payload: Payload,
  initialSouls: SoulBirthParams[]
): Promise<{ world: DigitalWorld; souls: DigitalSoul[] }> {
  const world = getDigitalWorld(payload);

  const souls: DigitalSoul[] = [];
  for (const params of initialSouls) {
    const soul = await world.birthSoul(params);
    souls.push(soul);
  }

  world.start();

  return { world, souls };
}
