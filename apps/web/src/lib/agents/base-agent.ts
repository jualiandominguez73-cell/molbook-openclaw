/**
 * Base Agent
 * Foundation for all 12 cognitive agents
 * Each agent is configured by soul composition through the agent mapper
 */

import type { Payload } from 'payload'

export interface AgentConfig {
  agentId: string
  agentName: string
  parameters: Record<string, number> // Soul-derived parameters (0-1)
  dominantSoul: string // Which soul aspect dominates this agent
  influenceWeights: Record<string, number> // Soul influences
}

export interface AgentState {
  energy: number // 0-1, decreases with processing
  mood: number // -1 to 1, affected by recent interactions
  attentionBudget: number // 0-1, how much attention left
  processingDepth: number // 0-1, current depth level
  recentOutputs: AgentOutput[]
}

export interface AgentInput {
  content: string
  context: Record<string, any>
  priority: number // 0-1
  sourceAgent?: string
  metadata: Record<string, any>
}

export interface AgentOutput {
  content: string
  confidence: number // 0-1
  reasoning: string // Why this agent produced this
  agentId: string
  agentName: string
  particleUsed?: string // Which particle generated this
  flags: string[] // e.g., ["high_uncertainty", "needs_review"]
  suggestions: Record<string, any> // For other agents
  processingTime: number // ms
}

export interface BusMessage {
  id: string
  type: 'excitatory' | 'inhibitory' | 'modulatory' | 'broadcast'
  sourceAgent: string
  targetAgent?: string // null for broadcasts
  content: any
  priority: number
  timestamp: Date
  ttl: number // Time-to-live in ms
}

export abstract class BaseAgent {
  protected payload: Payload
  protected config: AgentConfig
  protected state: AgentState

  // Core agent properties
  abstract agentId: string
  abstract agentName: string
  abstract layer: 'executive' | 'analytical' | 'integrative' | 'operational' | 'infrastructure'
  abstract description: string

  constructor(payload: Payload, config: AgentConfig) {
    this.payload = payload
    this.config = config
    this.state = {
      energy: 1.0,
      mood: 0.0,
      attentionBudget: 1.0,
      processingDepth: 0.5,
      recentOutputs: []
    }
  }

  /**
   * Main processing method - must be implemented by each agent
   */
  abstract process(input: AgentInput): Promise<AgentOutput>

  /**
   * Receive and process bus message
   */
  async receiveMessage(message: BusMessage): Promise<void> {
    // Base implementation - can be overridden
    switch (message.type) {
      case 'excitatory':
        // Boost signal - increase attention/energy for this
        this.state.energy = Math.min(1, this.state.energy + 0.1)
        break
      case 'inhibitory':
        // Suppress signal - decrease attention
        this.state.energy = Math.max(0, this.state.energy - 0.1)
        break
      case 'modulatory':
        // Adjust processing parameters
        if (message.content.processingDepth !== undefined) {
          this.state.processingDepth = message.content.processingDepth
        }
        break
      case 'broadcast':
        // Context update - all agents receive
        break
    }
  }

  /**
   * Apply soul-derived configuration
   */
  applyConfig(config: AgentConfig): void {
    this.config = config
  }

  /**
   * Get current energy level (0-1)
   */
  getEnergy(): number {
    return this.state.energy
  }

  /**
   * Get current mood (-1 to 1)
   */
  getMood(): number {
    return this.state.mood
  }

  /**
   * Get attention focus
   */
  getAttentionFocus(): string {
    return this.state.recentOutputs.length > 0
      ? this.state.recentOutputs[this.state.recentOutputs.length - 1].content.substring(0, 50)
      : 'idle'
  }

  /**
   * Get dominant particle (which foundation model dominates this agent)
   */
  getDominantParticle(): string {
    return this.config.dominantSoul || 'unknown'
  }

  /**
   * Consume energy for processing
   */
  protected consumeEnergy(amount: number): void {
    this.state.energy = Math.max(0, this.state.energy - amount)
  }

  /**
   * Recover energy (during rest/dreaming)
   */
  recoverEnergy(amount: number = 0.1): void {
    this.state.energy = Math.min(1, this.state.energy + amount)
  }

  /**
   * Update mood based on outcome
   */
  protected updateMood(delta: number): void {
    this.state.mood = Math.max(-1, Math.min(1, this.state.mood + delta))
  }

  /**
   * Store output in recent history
   */
  protected storeOutput(output: AgentOutput): void {
    this.state.recentOutputs.push(output)
    // Keep only last 10
    if (this.state.recentOutputs.length > 10) {
      this.state.recentOutputs.shift()
    }
  }

  /**
   * Get effective parameter value (soul-derived + state-adjusted)
   */
  protected getEffectiveParameter(paramName: string, baseValue: number = 0.5): number {
    const soulValue = this.config.parameters[paramName] || baseValue
    const energyFactor = this.state.energy // Low energy reduces all parameters
    const moodFactor = this.state.mood > 0 ? 1 + this.state.mood * 0.1 : 1 + this.state.mood * 0.05

    return Math.max(0, Math.min(1, soulValue * energyFactor * moodFactor))
  }

  /**
   * Create standard output structure
   */
  protected createOutput(
    content: string,
    confidence: number,
    reasoning: string,
    flags: string[] = [],
    suggestions: Record<string, any> = {}
  ): AgentOutput {
    const output: AgentOutput = {
      content,
      confidence,
      reasoning,
      agentId: this.agentId,
      agentName: this.agentName,
      flags,
      suggestions,
      processingTime: 0 // Will be set by caller
    }

    this.storeOutput(output)
    return output
  }

  /**
   * Get agent status report
   */
  getStatus(): {
    agentId: string
    agentName: string
    energy: number
    mood: number
    attentionBudget: number
    processingDepth: number
    dominantSoul: string
    recentActivity: number
  } {
    return {
      agentId: this.agentId,
      agentName: this.agentName,
      energy: this.state.energy,
      mood: this.state.mood,
      attentionBudget: this.state.attentionBudget,
      processingDepth: this.state.processingDepth,
      dominantSoul: this.config.dominantSoul,
      recentActivity: this.state.recentOutputs.length
    }
  }

  /**
   * Dreaming - offline consolidation for this agent
   */
  async dream(experiences: any[]): Promise<any[]> {
    // Base implementation - agents can override for specialized dreaming
    const insights: any[] = []

    // Review recent outputs
    for (const output of this.state.recentOutputs) {
      // What did I learn? What could I improve?
      if (output.confidence < 0.6) {
        insights.push({
          type: 'low_confidence',
          content: `Review reasoning for: ${output.content.substring(0, 100)}`,
          agentId: this.agentId
        })
      }
    }

    // Energy recovery during dreaming
    this.recoverEnergy(0.3)

    return insights
  }
}
