/**
 * Agent Humanization Service - Main Orchestrator
 * Coordinates all 8 humanization gaps:
 * 1. Contexto Persistente (Memory)
 * 2. Autonomia com Risco (Autonomy)
 * 3. Aprendizado Contínuo (Learning)
 * 4. Relacionamentos (Relationships)
 * 5. Intuição & Julgamento (Intuition)
 * 6. Gestão de Energia (Energy)
 * 7. Conflito & Negociação (Negotiation)
 * 8. Reputação & Accountability (Reputation)
 */

import Redis from "ioredis";
import { Pool } from "pg";
import {
  AgentHumanizationProfile,
  HumanizationRequest,
  HumanizationResponse,
  AutonomyType,
  RiskLevel,
  AgentReputation,
  EnergyState,
  AgentMemory,
  PersonInsight,
} from "./models/types";

export class HumanizationService {
  private db: Pool;
  private redis: Redis;
  private initialized: boolean = false;

  constructor(dbConfig: any, redisConfig: any) {
    this.db = new Pool(dbConfig);
    this.redis = new Redis(redisConfig);
  }

  /**
   * Initialize service and verify connections
   */
  async initialize(): Promise<void> {
    try {
      // Test PostgreSQL connection
      const pgTest = await this.db.query("SELECT NOW()");
      console.log("✅ PostgreSQL connected:", pgTest.rows[0]);

      // Test Redis connection
      const redisTest = await this.redis.ping();
      console.log("✅ Redis connected:", redisTest);

      this.initialized = true;
      console.log("✅ Humanization Service initialized");
    } catch (error) {
      console.error("❌ Failed to initialize service:", error);
      throw error;
    }
  }

  /**
   * Main entry point: Process agent request with humanization lens
   * Routes request through all 8 gap handlers
   */
  async processRequest(request: HumanizationRequest): Promise<HumanizationResponse> {
    const { agentId, context, details, timestamp } = request;

    console.log(`\n🤖 Processing humanization request for agent: ${agentId}`);
    console.log(`   Context: ${context}`);

    // Get agent's humanization profile
    const profile = await this.getAgentProfile(agentId);

    let response: HumanizationResponse = {
      agentId,
      recommendation: "",
      confidenceScore: 0,
      autonomyLevel: AutonomyType.ASK_THEN_WAIT,
    };

    // Route by context
    switch (context) {
      case "decision":
        response = await this.handleDecisionRequest(profile, details, timestamp);
        break;
      case "interaction":
        response = await this.handleInteractionRequest(profile, details, timestamp);
        break;
      case "task":
        response = await this.handleTaskRequest(profile, details, timestamp);
        break;
      case "learning":
        response = await this.handleLearningRequest(profile, details, timestamp);
        break;
      case "conflict":
        response = await this.handleConflictRequest(profile, details, timestamp);
        break;
    }

    // Cache response for fast re-access
    await this.cacheResponse(agentId, context, response);

    return response;
  }

  /**
   * GAP 1: CONTEXTO PERSISTENTE
   * Load agent's memory to inform decisions
   */
  async getAgentProfile(agentId: string): Promise<AgentHumanizationProfile> {
    // Try cache first
    const cached = await this.redis.get(`agent:${agentId}:profile`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fetch from database
    const profile: AgentHumanizationProfile = {
      agentId,
      memory: await this.loadAgentMemory(agentId),
      relationships: await this.loadRelationships(agentId),
      reputation: await this.loadReputation(agentId),
      trackRecord: await this.loadTrackRecord(agentId),
      learningProgress: await this.loadLearningProgress(agentId),
      currentEnergy: await this.getCurrentEnergyState(agentId),
      autonomyConfig: await this.loadAutonomyConfig(agentId),
      intuitionRules: await this.loadIntuitionRules(agentId),
      assertivenessRules: await this.loadAssertivenessRules(agentId),
    };

    // Cache for 1 hour
    await this.redis.setex(`agent:${agentId}:profile`, 3600, JSON.stringify(profile));

    return profile;
  }

  private async loadAgentMemory(agentId: string): Promise<AgentMemory[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_memory 
       WHERE agent_id = $1 
       ORDER BY importance DESC, created_at DESC 
       LIMIT 50`,
      [agentId],
    );
    return result.rows;
  }

  private async loadRelationships(agentId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_relationships 
       WHERE agent_id = $1 
       ORDER BY trust_score DESC`,
      [agentId],
    );
    return result.rows;
  }

  private async loadReputation(agentId: string): Promise<AgentReputation> {
    const result = await this.db.query(`SELECT * FROM agent_reputation WHERE agent_id = $1`, [
      agentId,
    ]);
    return result.rows[0] || this.createDefaultReputation(agentId);
  }

  private createDefaultReputation(agentId: string): AgentReputation {
    return {
      id: "",
      agentId,
      reliabilityScore: 0.5,
      speedRating: "unknown",
      qualityRating: "unknown",
      accountabilityScore: 0.5,
      communicationScore: 0.5,
      collaborationScore: 0.5,
      trend: "stable",
      lastUpdated: new Date(),
    };
  }

  private async loadTrackRecord(agentId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_track_record 
       WHERE agent_id = $1 
       ORDER BY completed_at DESC 
       LIMIT 10`,
      [agentId],
    );
    return result.rows;
  }

  private async loadLearningProgress(agentId: string): Promise<any[]> {
    // Load from time-series (TimescaleDB)
    const result = await this.db.query(
      `SELECT DISTINCT ON (skill_name) 
         skill_name, 
         proficiency, 
         improvement_rate, 
         practice_hours
       FROM agent_learning_progress 
       WHERE agent_id = $1 
       ORDER BY skill_name, time DESC`,
      [agentId],
    );
    return result.rows;
  }

  private async getCurrentEnergyState(agentId: string): Promise<EnergyState> {
    const result = await this.db.query(`SELECT * FROM agent_energy_state WHERE agent_id = $1`, [
      agentId,
    ]);
    return result.rows[0] || this.createDefaultEnergyState(agentId);
  }

  private createDefaultEnergyState(agentId: string): EnergyState {
    return {
      id: "",
      agentId,
      currentHour: new Date().toISOString().slice(11, 16),
      energyLevel: 0.7,
      focusLevel: 0.7,
      contextSwitchesToday: 0,
      deepWorkMinutes: 0,
      qualityVariance: 0,
      lastUpdated: new Date(),
    };
  }

  private async loadAutonomyConfig(agentId: string): Promise<any[]> {
    const result = await this.db.query(`SELECT * FROM agent_autonomy_config WHERE agent_id = $1`, [
      agentId,
    ]);
    return result.rows.length > 0 ? result.rows : this.createDefaultAutonomyConfig();
  }

  private createDefaultAutonomyConfig() {
    return [
      {
        risk_level: "low",
        autonomy_type: AutonomyType.FULL,
        definition: "Less than 2 hours impact",
      },
      {
        risk_level: "medium",
        autonomy_type: AutonomyType.PROPOSE_THEN_DECIDE,
        definition: "2-48 hours impact",
      },
      {
        risk_level: "high",
        autonomy_type: AutonomyType.ASK_THEN_WAIT,
        definition: "More than 48 hours impact",
      },
    ];
  }

  private async loadIntuitionRules(agentId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_intuition_rules 
       WHERE agent_id = $1 
       ORDER BY accuracy_rate DESC 
       LIMIT 20`,
      [agentId],
    );
    return result.rows;
  }

  private async loadAssertivenessRules(agentId: string): Promise<any[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_assertiveness_rules 
       WHERE agent_id = $1`,
      [agentId],
    );
    return result.rows;
  }

  /**
   * GAP 2: AUTONOMIA COM RISCO
   * Determine appropriate autonomy level for decision
   */
  private async handleDecisionRequest(
    profile: AgentHumanizationProfile,
    details: any,
    timestamp: Date,
  ): Promise<HumanizationResponse> {
    const { riskLevel } = details;

    // Find applicable autonomy config
    const autonomyConfig = profile.autonomyConfig.find((c: any) => c.risk_level === riskLevel);

    const autonomyLevel = autonomyConfig
      ? autonomyConfig.autonomy_type
      : AutonomyType.ASK_THEN_WAIT;

    // GAP 5: INTUIÇÃO - Check if pattern matches known successful decision pattern
    const relevantRules = this.matchIntuitionRules(profile.intuitionRules, details.context);

    // Build recommendation
    const recommendation = this.buildDecisionRecommendation(
      autonomyLevel,
      profile.reputation,
      relevantRules,
    );

    // Log decision for learning (GAP 3)
    await this.logDecision(profile.agentId, details.decisionType, autonomyLevel, timestamp);

    // Calculate confidence based on reputation (GAP 8) + intuition accuracy
    const confidenceScore = this.calculateConfidence(
      profile.reputation,
      relevantRules,
      autonomyLevel,
    );

    return {
      agentId: profile.agentId,
      recommendation,
      autonomyLevel,
      relevantMemories: profile.memory.slice(0, 5),
      confidenceScore,
    };
  }

  /**
   * GAP 4: RELACIONAMENTOS
   * Use relationship insights to inform interaction
   */
  private async handleInteractionRequest(
    profile: AgentHumanizationProfile,
    details: any,
    timestamp: Date,
  ): Promise<HumanizationResponse> {
    const { targetAgentId, interactionType } = details;

    // Find relationship with target
    const relationship = profile.relationships.find((r: any) => r.other_agent_id === targetAgentId);

    // Get person insights
    const personInsights = await this.getPersonInsights(profile.agentId, targetAgentId);

    // Build communication recommendation based on relationship & insights
    const recommendation = this.buildInteractionRecommendation(
      relationship,
      personInsights,
      interactionType,
    );

    return {
      agentId: profile.agentId,
      recommendation,
      relatedPeople: personInsights,
      confidenceScore: relationship?.trust_score || 0.5,
    };
  }

  /**
   * GAP 3: APRENDIZADO CONTÍNUO
   * Log learning and improve future decisions
   */
  private async handleLearningRequest(
    profile: AgentHumanizationProfile,
    details: any,
    timestamp: Date,
  ): Promise<HumanizationResponse> {
    const { lessonType, lesson, outcome } = details;

    // Record learning
    await this.recordLearning(profile.agentId, {
      lessonType,
      lesson,
      outcome,
      timestamp,
    });

    // Update mistake patterns if applicable
    if (lessonType === "mistake") {
      await this.updateMistakePattern(profile.agentId, lesson);
    }

    const recommendation = `✅ Logged: "${lesson}". This will improve future decisions.`;

    return {
      agentId: profile.agentId,
      recommendation,
      confidenceScore: 1.0,
    };
  }

  /**
   * GAP 7: CONFLITO & NEGOCIAÇÃO
   * Provide assertiveness guidance
   */
  private async handleConflictRequest(
    profile: AgentHumanizationProfile,
    details: any,
    timestamp: Date,
  ): Promise<HumanizationResponse> {
    const { concernType, concernLevel } = details;

    // Find applicable assertiveness rule
    const rule = profile.assertivenessRules.find(
      (r: any) => r.concern_type === concernType && r.concern_level === concernLevel,
    );

    const recommendation = rule?.recommended_response || this.getDefaultAssertiveness(concernLevel);

    // Record conflict for learning
    await this.recordConflict(profile.agentId, {
      type: concernType,
      level: concernLevel,
      timestamp,
    });

    return {
      agentId: profile.agentId,
      recommendation,
      confidenceScore: rule ? 0.9 : 0.6,
    };
  }

  /**
   * GAP 6: GESTÃO DE ENERGIA
   * Adjust expectations based on energy level
   */
  private async handleTaskRequest(
    profile: AgentHumanizationProfile,
    details: any,
    timestamp: Date,
  ): Promise<HumanizationResponse> {
    const { taskComplexity } = details;
    const energy = profile.currentEnergy;

    // Adjust quality expectations based on energy
    const energyFactor = this.calculateEnergyFactor(energy);

    const recommendation = this.buildTaskRecommendation(taskComplexity, energy, energyFactor);

    // Log energy state change
    await this.updateEnergyState(profile.agentId, { timestamp });

    return {
      agentId: profile.agentId,
      recommendation,
      energyFactor,
      confidenceScore: 0.8,
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  private matchIntuitionRules(rules: any[], context: any): any[] {
    return rules
      .map((rule) => ({
        ...rule,
        matchScore: this.calculateMatchScore(rule.trigger_conditions, context),
      }))
      .filter((r) => r.matchScore > 0.5)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  private calculateMatchScore(conditions: any, context: any): number {
    if (!conditions || !context) return 0;
    let score = 0;
    let matches = 0;
    for (const [key, expected] of Object.entries(conditions)) {
      if (context[key] === expected) {
        matches++;
      }
    }
    return matches > 0 ? matches / Object.keys(conditions).length : 0;
  }

  private buildDecisionRecommendation(
    autonomyLevel: AutonomyType,
    reputation: AgentReputation,
    rules: any[],
  ): string {
    let recommendation = "";

    switch (autonomyLevel) {
      case AutonomyType.FULL:
        recommendation = `✅ **You have full autonomy** to make this decision. `;
        break;
      case AutonomyType.PROPOSE_THEN_DECIDE:
        recommendation = `💭 **Propose your approach**, then decide if you don't get objections within 2 hours.`;
        break;
      case AutonomyType.ASK_THEN_WAIT:
        recommendation = `❓ **Ask for permission** before proceeding. This is a high-risk decision.`;
        break;
    }

    if (reputation.trend === "improving") {
      recommendation += " Your reputation is improving, so trust is growing. ⬆️";
    } else if (reputation.trend === "declining") {
      recommendation += " Note: Your reputation needs improvement. Be extra careful. ⚠️";
    }

    if (rules.length > 0) {
      recommendation += ` Also, I've seen ${rules[0].pattern_name} before, which ended well.`;
    }

    return recommendation;
  }

  private calculateConfidence(
    reputation: AgentReputation,
    rules: any[],
    autonomyLevel: AutonomyType,
  ): number {
    let score = reputation.reliabilityScore * 0.4;
    if (rules.length > 0) {
      score += rules[0].accuracy_rate * 0.4;
    }
    score += autonomyLevel === AutonomyType.FULL ? 0.2 : 0.1;
    return Math.min(score, 1.0);
  }

  private buildInteractionRecommendation(
    relationship: any,
    insights: PersonInsight[],
    interactionType: string,
  ): string {
    let recommendation = "";

    if (!relationship) {
      return `👤 First interaction with this person. Be formal and clear.`;
    }

    if (relationship.collaboration_quality === "excellent") {
      recommendation = `🤝 Great collaboration history! This person is a strong collaborator. `;
    } else if (relationship.collaboration_quality === "poor") {
      recommendation = `⚠️ Past interactions were challenging. Proceed with extra care and clarity. `;
    }

    // Add communication style if known
    const commInsight = insights.find((i) => i.insightType === "communication_style");
    if (commInsight) {
      recommendation += `They prefer: ${commInsight.insightText}`;
    }

    return recommendation;
  }

  private buildTaskRecommendation(complexity: string, energy: EnergyState, factor: number): string {
    const energyLevel =
      energy.energyLevel > 0.7 ? "high" : energy.energyLevel > 0.4 ? "medium" : "low";

    return `⚡ Your energy is ${energyLevel}. ${
      factor < 0.8 ? "Consider simpler tasks now, deep work later." : "Good time for complex work."
    }`;
  }

  private calculateEnergyFactor(energy: EnergyState): number {
    return energy.energyLevel * energy.focusLevel;
  }

  private getDefaultAssertiveness(level: string): string {
    const responses: Record<string, string> = {
      critical: "🔴 **This is critical.** You MUST push back and escalate immediately.",
      high: '🟡 **This is important.** Express your concern respectfully: "I have concerns about..."',
      medium: "🟠 **Note your concern** but be open to discussion.",
      low: "🟢 You can live with this, but document your concern for future reference.",
    };
    return responses[level] || "Express your concern constructively.";
  }

  private async getPersonInsights(agentId: string, personId: string): Promise<PersonInsight[]> {
    const result = await this.db.query(
      `SELECT * FROM agent_person_insights 
       WHERE agent_id = $1 AND person_id = $2 
       ORDER BY confidence DESC`,
      [agentId, personId],
    );
    return result.rows;
  }

  private async logDecision(
    agentId: string,
    decisionType: string,
    autonomyLevel: AutonomyType,
    timestamp: Date,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO agent_decision_log 
       (time, agent_id, decision_type, decision_quality, decision_time) 
       VALUES ($1, $2, $3, $4, $5)`,
      [timestamp, agentId, decisionType, "pending", timestamp],
    );
  }

  private async recordLearning(agentId: string, lesson: any): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    // Implementation would insert into agent_learning_logs
    console.log(`📚 Recorded learning for ${agentId}: ${lesson.lesson}`);
  }

  private async updateMistakePattern(agentId: string, mistakeType: string): Promise<void> {
    // Implementation would update agent_mistake_patterns
    console.log(`❌ Updated mistake pattern: ${mistakeType}`);
  }

  private async recordConflict(agentId: string, conflict: any): Promise<void> {
    // Implementation would insert into agent_conflict_history
    console.log(`🔴 Recorded conflict: ${conflict.type} (level: ${conflict.level})`);
  }

  private async updateEnergyState(agentId: string, data: any): Promise<void> {
    // Implementation would update agent_energy_state and insert into TimescaleDB
    console.log(`⚡ Updated energy state for ${agentId}`);
  }

  private async cacheResponse(
    agentId: string,
    context: string,
    response: HumanizationResponse,
  ): Promise<void> {
    const key = `humanization:${agentId}:${context}`;
    await this.redis.setex(key, 300, JSON.stringify(response)); // Cache for 5 min
  }

  /**
   * Clean shutdown
   */
  async close(): Promise<void> {
    await this.db.end();
    await this.redis.disconnect();
    console.log("✅ Humanization Service closed");
  }
}
