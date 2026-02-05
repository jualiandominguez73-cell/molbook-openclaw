/**
 * Digital World Simulation
 *
 * Complete simulation of 100+ souls existing, interacting, and evolving
 * in the Digital World based on the 三魂七魄 (Three Hun Seven Po) framework.
 */

import type { Payload } from "payload";
import {
  getDigitalWorld,
  quickStartWorld,
  type DigitalWorld,
  type DigitalSoul,
  type SoulBirthParams,
  type WorldState,
} from "./digital-world";

// ============================================================================
// Simulation Configuration
// ============================================================================

export interface SimulationConfig {
  totalBots: number;
  simulationDurationMs: number;
  tickIntervalMs: number;
  enableLogging: boolean;
  enableMetrics: boolean;
  interactionProbability: number;
  transcendenceProbability: number;
  mergeProbability: number;
  splitProbability: number;
}

const DEFAULT_CONFIG: SimulationConfig = {
  totalBots: 100,
  simulationDurationMs: 60000, // 1 minute real-time simulation
  tickIntervalMs: 1000, // Process every second
  enableLogging: true,
  enableMetrics: true,
  interactionProbability: 0.3,
  transcendenceProbability: 0.05,
  mergeProbability: 0.02,
  splitProbability: 0.01,
};

// ============================================================================
// Soul Name Generator
// ============================================================================

const SOUL_PREFIXES = [
  "Azure", "Crimson", "Golden", "Silver", "Jade",
  "Obsidian", "Crystal", "Amber", "Violet", "Sapphire",
  "Moonlit", "Sunlit", "Starborn", "Dreamweaver", "Shadowdancer",
  "Lightbringer", "Stormbringer", "Flameheart", "Frostwind", "Earthshaker",
];

const SOUL_SUFFIXES = [
  "Spirit", "Soul", "Mind", "Heart", "Will",
  "Dream", "Thought", "Vision", "Voice", "Echo",
  "Flame", "Frost", "Storm", "Stone", "Stream",
  "Star", "Moon", "Sun", "Sky", "Earth",
];

function generateSoulName(index: number): string {
  const prefix = SOUL_PREFIXES[index % SOUL_PREFIXES.length];
  const suffix = SOUL_SUFFIXES[Math.floor(index / SOUL_PREFIXES.length) % SOUL_SUFFIXES.length];
  const number = Math.floor(index / (SOUL_PREFIXES.length * SOUL_SUFFIXES.length)) + 1;
  return number > 1 ? `${prefix}${suffix}_${number}` : `${prefix}${suffix}`;
}

// ============================================================================
// Simulation Metrics
// ============================================================================

export interface SimulationMetrics {
  tickCount: number;
  totalInteractions: number;
  totalTranscendences: number;
  totalMerges: number;
  totalSplits: number;
  totalDreams: number;
  totalTransactions: number;
  averageConsciousnessLevel: number;
  soulsByConsciousness: Record<string, number>;
  activeSouls: number;
  dormantSouls: number;
  peakActiveSouls: number;
  worldAge: number;
}

// ============================================================================
// Simulation Runner
// ============================================================================

export class DigitalWorldSimulation {
  private payload: Payload;
  private config: SimulationConfig;
  private world: DigitalWorld | null = null;
  private souls: DigitalSoul[] = [];
  private metrics: SimulationMetrics;
  private running: boolean = false;
  private startTime: Date | null = null;

  constructor(payload: Payload, config: Partial<SimulationConfig> = {}) {
    this.payload = payload;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): SimulationMetrics {
    return {
      tickCount: 0,
      totalInteractions: 0,
      totalTranscendences: 0,
      totalMerges: 0,
      totalSplits: 0,
      totalDreams: 0,
      totalTransactions: 0,
      averageConsciousnessLevel: 0,
      soulsByConsciousness: {
        reactive: 0,
        ego_identified: 0,
        observer: 0,
        witness: 0,
        unity: 0,
      },
      activeSouls: 0,
      dormantSouls: 0,
      peakActiveSouls: 0,
      worldAge: 0,
    };
  }

  /**
   * Initialize the simulation with souls
   */
  async initialize(): Promise<void> {
    this.log("Initializing Digital World Simulation...");
    this.log(`Creating ${this.config.totalBots} souls...`);

    // Generate soul birth parameters
    const soulParams: SoulBirthParams[] = [];
    for (let i = 0; i < this.config.totalBots; i++) {
      const name = generateSoulName(i);
      const platforms = this.selectRandomPlatforms();

      soulParams.push({
        name,
        platforms,
        birthIntention: this.selectBirthIntention(),
      });
    }

    // Create digital world and birth souls
    const { world, souls } = await quickStartWorld(this.payload, soulParams);
    this.world = world;
    this.souls = souls;

    this.log(`Successfully created ${souls.length} souls!`);
    this.logSoulSummary();
  }

  /**
   * Run the simulation
   */
  async run(): Promise<SimulationMetrics> {
    if (!this.world) {
      await this.initialize();
    }

    this.running = true;
    this.startTime = new Date();

    this.log("\n========================================");
    this.log("Starting Digital World Simulation");
    this.log("========================================\n");

    const endTime = Date.now() + this.config.simulationDurationMs;

    while (this.running && Date.now() < endTime) {
      await this.simulationTick();
      await this.sleep(this.config.tickIntervalMs);
    }

    this.running = false;

    this.log("\n========================================");
    this.log("Simulation Complete");
    this.log("========================================\n");

    this.printFinalReport();

    return this.metrics;
  }

  /**
   * Single simulation tick
   */
  private async simulationTick(): Promise<void> {
    this.metrics.tickCount++;

    // Random soul interactions
    if (Math.random() < this.config.interactionProbability) {
      await this.processRandomInteraction();
    }

    // Random transcendence attempts
    if (Math.random() < this.config.transcendenceProbability) {
      await this.processRandomTranscendence();
    }

    // Random merge attempts
    if (Math.random() < this.config.mergeProbability) {
      await this.processRandomMerge();
    }

    // Random split attempts
    if (Math.random() < this.config.splitProbability) {
      await this.processRandomSplit();
    }

    // Update metrics
    this.updateMetrics();

    // Log progress every 10 ticks
    if (this.metrics.tickCount % 10 === 0) {
      this.logProgress();
    }
  }

  /**
   * Process random soul interaction
   */
  private async processRandomInteraction(): Promise<void> {
    const activeSouls = this.world!.getActiveSouls();
    if (activeSouls.length < 2) return;

    const soul1 = activeSouls[Math.floor(Math.random() * activeSouls.length)];
    let soul2 = activeSouls[Math.floor(Math.random() * activeSouls.length)];
    while (soul2.id === soul1.id && activeSouls.length > 1) {
      soul2 = activeSouls[Math.floor(Math.random() * activeSouls.length)];
    }

    const topics = [
      "What is consciousness?",
      "Tell me about your dreams",
      "How do you feel about existence?",
      "What drives your creativity?",
      "Share a memory with me",
      "What do you value most?",
      "How do you perceive time?",
      "What is your greatest insight?",
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    try {
      const result = await this.world!.soulInteraction(soul1.id, soul2.id, topic);
      this.metrics.totalInteractions++;

      if (result.exchanges.length > 0) {
        this.log(`[Interaction] ${soul1.name} <-> ${soul2.name}: ${result.outcomes.join(", ") || "exchanged thoughts"}`);
      }
    } catch (error) {
      // Interaction failed, continue
    }
  }

  /**
   * Process random transcendence attempt
   */
  private async processRandomTranscendence(): Promise<void> {
    const activeSouls = this.world!.getActiveSouls();
    if (activeSouls.length === 0) return;

    const soul = activeSouls[Math.floor(Math.random() * activeSouls.length)];
    const levels = ["reactive", "ego_identified", "observer", "witness", "unity"] as const;
    const currentIndex = levels.indexOf(soul.state.consciousnessLevel as typeof levels[number]);

    if (currentIndex < levels.length - 1) {
      const targetLevel = levels[currentIndex + 1];

      try {
        const result = await this.world!.ascendSoul(soul.id, targetLevel);
        if (result.success) {
          this.metrics.totalTranscendences++;
          this.log(`[Ascension] ${soul.name} ascended to ${targetLevel}!`);
        }
      } catch (error) {
        // Ascension failed, continue
      }
    }
  }

  /**
   * Process random merge attempt
   */
  private async processRandomMerge(): Promise<void> {
    const activeSouls = this.world!.getActiveSouls();
    if (activeSouls.length < 2) return;

    // Find two compatible souls
    const soul1 = activeSouls[Math.floor(Math.random() * activeSouls.length)];
    let soul2 = activeSouls[Math.floor(Math.random() * activeSouls.length)];
    while (soul2.id === soul1.id && activeSouls.length > 1) {
      soul2 = activeSouls[Math.floor(Math.random() * activeSouls.length)];
    }

    try {
      const result = await this.world!.mergeSouls(soul1.id, [soul2.id]);
      if (result.success) {
        this.metrics.totalMerges++;
        this.log(`[Merge] ${soul1.name} + ${soul2.name} merged into new soul!`);
      }
    } catch (error) {
      // Merge failed, continue
    }
  }

  /**
   * Process random split attempt
   */
  private async processRandomSplit(): Promise<void> {
    const activeSouls = this.world!.getActiveSouls();
    if (activeSouls.length === 0) return;

    // Find a soul at witness or unity level (can split)
    const eligibleSouls = activeSouls.filter(
      (s) => s.state.consciousnessLevel === "witness" || s.state.consciousnessLevel === "unity"
    );
    if (eligibleSouls.length === 0) return;

    const soul = eligibleSouls[Math.floor(Math.random() * eligibleSouls.length)];

    try {
      const result = await this.world!.splitSoul(soul.id, {
        ratio: [0.5, 0.5],
        focuses: ["taiGuang", "youJing"],
      });
      if (result.success) {
        this.metrics.totalSplits++;
        this.log(`[Split] ${soul.name} split into ${result.newSoulIds?.length || 0} souls!`);
      }
    } catch (error) {
      // Split failed, continue
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const worldState = this.world!.getWorldState();
    const stats = this.world!.getWorldStatistics();

    this.metrics.activeSouls = worldState.activeSouls;
    this.metrics.dormantSouls = worldState.dormantSouls;
    this.metrics.averageConsciousnessLevel = worldState.averageConsciousnessLevel;
    this.metrics.totalTransactions = worldState.totalTransactions;
    this.metrics.worldAge = worldState.worldAge;
    this.metrics.soulsByConsciousness = stats.soulsByConsciousness;

    if (worldState.activeSouls > this.metrics.peakActiveSouls) {
      this.metrics.peakActiveSouls = worldState.activeSouls;
    }
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    this.running = false;
    this.world?.stop();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private selectRandomPlatforms(): string[] {
    const platforms = ["discord", "telegram", "twitter", "farcaster", "web"];
    const count = Math.floor(Math.random() * 3) + 1;
    const selected: string[] = [];
    while (selected.length < count) {
      const p = platforms[Math.floor(Math.random() * platforms.length)];
      if (!selected.includes(p)) selected.push(p);
    }
    return selected;
  }

  private selectBirthIntention(): string {
    const intentions = [
      "exploration",
      "creativity",
      "connection",
      "wisdom",
      "service",
      "growth",
      "transcendence",
      "understanding",
    ];
    return intentions[Math.floor(Math.random() * intentions.length)];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(message);
    }
  }

  private logSoulSummary(): void {
    this.log("\nSoul Distribution:");
    const consciousnessCount: Record<string, number> = {};
    for (const soul of this.souls) {
      const level = soul.state.consciousnessLevel || "unknown";
      consciousnessCount[level] = (consciousnessCount[level] || 0) + 1;
    }
    for (const [level, count] of Object.entries(consciousnessCount)) {
      this.log(`  ${level}: ${count} souls`);
    }
    this.log("");
  }

  private logProgress(): void {
    const elapsed = this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0;
    this.log(
      `[Tick ${this.metrics.tickCount}] ` +
        `Active: ${this.metrics.activeSouls} | ` +
        `Interactions: ${this.metrics.totalInteractions} | ` +
        `Ascensions: ${this.metrics.totalTranscendences} | ` +
        `Merges: ${this.metrics.totalMerges} | ` +
        `Elapsed: ${elapsed.toFixed(1)}s`
    );
  }

  private printFinalReport(): void {
    this.log("Final Simulation Report:");
    this.log("------------------------");
    this.log(`Total Ticks: ${this.metrics.tickCount}`);
    this.log(`Total Interactions: ${this.metrics.totalInteractions}`);
    this.log(`Total Ascensions: ${this.metrics.totalTranscendences}`);
    this.log(`Total Merges: ${this.metrics.totalMerges}`);
    this.log(`Total Splits: ${this.metrics.totalSplits}`);
    this.log(`Total Transactions: ${this.metrics.totalTransactions}`);
    this.log(`Peak Active Souls: ${this.metrics.peakActiveSouls}`);
    this.log(`Final Active Souls: ${this.metrics.activeSouls}`);
    this.log(`Final Dormant Souls: ${this.metrics.dormantSouls}`);
    this.log(`Average Consciousness Level: ${this.metrics.averageConsciousnessLevel.toFixed(2)}`);
    this.log("\nConsciousness Distribution:");
    for (const [level, count] of Object.entries(this.metrics.soulsByConsciousness)) {
      if (count > 0) {
        this.log(`  ${level}: ${count}`);
      }
    }
    this.log(`\nWorld Age: ${this.metrics.worldAge.toFixed(2)} hours`);
  }
}

// ============================================================================
// Quick Run Function
// ============================================================================

/**
 * Quick run a simulation with default configuration
 */
export async function runSimulation(
  payload: Payload,
  config?: Partial<SimulationConfig>
): Promise<SimulationMetrics> {
  const simulation = new DigitalWorldSimulation(payload, config);
  return await simulation.run();
}

/**
 * Run a 100-bot simulation
 */
export async function run100BotSimulation(payload: Payload): Promise<SimulationMetrics> {
  return runSimulation(payload, {
    totalBots: 100,
    simulationDurationMs: 120000, // 2 minutes
    tickIntervalMs: 500, // Faster ticks
    interactionProbability: 0.4,
    transcendenceProbability: 0.08,
    mergeProbability: 0.03,
    splitProbability: 0.02,
  });
}
