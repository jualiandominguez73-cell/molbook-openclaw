/**
 * Multi-Bot Conversation System
 *
 * Conversations emerge from soul interactions:
 * - Turn-taking (not rigid - interruptions possible)
 * - Influence (persuasive bots shift opinions)
 * - Emotional contagion (moods spread)
 * - Group dynamics (coalitions, conflicts, status hierarchies)
 */

import type { Payload } from 'payload'
import { getSoulStateManager, type SoulState } from '../soul/soul-state'
import { getPheromoneSystem } from '../soul/pheromone-system'

/**
 * Conversation state
 */
export interface ConversationState {
  id: string
  participants: string[] // Bot IDs
  topic: string
  turn: number
  emotionalField: number // Group mood (-1 to 1)
  arousal: number // Group activation level (0-1)
  speakingOrder: string[] // Who has spoken
  dominanceHierarchy: Record<string, number> // Bot ID → dominance score
  coalitions: string[][] // Groups of aligned bots
  active: boolean
  startedAt: Date
  lastActivity: Date

  // Pheromone-based social dynamics
  pheromoneAffinities: Record<string, Record<string, number>> // Bot ID → Bot ID → affinity (-1 to 1)
  tensionFactors: Record<string, number> // Bot ID → tension level from pheromone repulsion
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  speaker: string // Bot ID
  content: string
  style: string
  emotionalTone: number
  influenceAttempt: boolean
  reactions: Array<{
    bot: string
    type: 'agree' | 'disagree' | 'question' | 'ignore'
    intensity: number
  }>
}

/**
 * Multi-bot conversation system
 */
export class MultiBotConversationSystem {
  private payload: Payload
  private soulStateManager: ReturnType<typeof getSoulStateManager>
  private pheromoneSystem: ReturnType<typeof getPheromoneSystem>

  constructor(payload: Payload) {
    this.payload = payload
    this.soulStateManager = getSoulStateManager(payload)
    this.pheromoneSystem = getPheromoneSystem(payload)
  }

  /**
   * Start a multi-bot conversation
   */
  async startConversation(
    botIds: string[],
    topic: string
  ): Promise<ConversationState> {
    if (botIds.length < 2) {
      throw new Error('Need at least 2 bots for conversation')
    }

    // Calculate initial dominance hierarchy
    const dominance = await this.calculateDominanceHierarchy(botIds)

    // Calculate pheromone affinities (unconscious chemistry)
    const pheromoneAffinities = await this.calculatePheromoneAffinities(botIds)
    const tensionFactors: Record<string, number> = {}

    // Initialize tension factors from repulsions
    for (const botId of botIds) {
      let totalTension = 0
      let repulsionCount = 0

      for (const [targetId, affinity] of Object.entries(pheromoneAffinities[botId] || {})) {
        if (affinity < -0.3) { // Repulsion threshold
          totalTension += Math.abs(affinity)
          repulsionCount++
        }
      }

      tensionFactors[botId] = repulsionCount > 0 ? totalTension / repulsionCount : 0
    }

    const state: ConversationState = {
      id: `conv_${Date.now()}`,
      participants: botIds,
      topic,
      turn: 0,
      emotionalField: 0, // Neutral
      arousal: 0.5, // Moderate
      speakingOrder: [],
      dominanceHierarchy: dominance,
      coalitions: [],
      active: true,
      startedAt: new Date(),
      lastActivity: new Date(),
      pheromoneAffinities,
      tensionFactors
    }

    this.payload.logger.info(
      `Started conversation ${state.id}: ${botIds.length} participants on topic "${topic}"`
    )

    return state
  }

  /**
   * Process one turn of conversation
   */
  async processTurn(
    state: ConversationState
  ): Promise<{
    turn: ConversationTurn
    newState: ConversationState
  }> {
    // 1. Select who speaks next
    const speaker = this.selectSpeaker(state)

    // 2. Get speaker's soul state
    const soulState = await this.getSoulState(speaker)

    // 3. Generate response based on soul + conversation context
    const response = await this.generateResponse(soulState, state)

    // 4. Other bots react
    const reactions = await this.generateReactions(state, speaker, response)

    const turn: ConversationTurn = {
      speaker,
      content: response.content,
      style: response.style,
      emotionalTone: response.emotionalTone,
      influenceAttempt: response.influenceAttempt,
      reactions
    }

    // 5. Update conversation state
    const newState = this.updateConversationState(state, turn)

    return { turn, newState }
  }

  /**
   * Select who speaks next (not purely sequential)
   */
  private selectSpeaker(state: ConversationState): string {
    // Factors:
    // - Dominance (high = more likely to speak)
    // - Pheromone tension (high = more likely to interrupt)
    // - Turn history (those who haven't spoken get boost)
    // - Emotional arousal (high = interrupts more)

    const scores: Record<string, number> = {}

    for (const botId of state.participants) {
      let score = 0

      // Dominance contribution
      score += (state.dominanceHierarchy[botId] || 0.5) * 0.3

      // Pheromone tension (uncomfortable = wants to speak up)
      const tension = state.tensionFactors[botId] || 0
      score += tension * 0.25

      // Haven't spoken recently boost
      const lastSpoke = state.speakingOrder.lastIndexOf(botId)
      if (lastSpoke === -1) {
        score += 0.3 // Never spoken
      } else {
        const turnsSince = state.speakingOrder.length - lastSpoke
        score += Math.min(0.3, turnsSince * 0.05)
      }

      // Random arousal factor (emotional activation)
      score += Math.random() * 0.15

      scores[botId] = score
    }

    // Select with weighted probability
    const total = Object.values(scores).reduce((a, b) => a + b, 0)
    const random = Math.random() * total
    let cumulative = 0

    for (const [botId, score] of Object.entries(scores)) {
      cumulative += score
      if (random <= cumulative) {
        return botId
      }
    }

    // Fallback
    return state.participants[0]
  }

  /**
   * Get soul state for bot
   */
  private async getSoulState(botId: string): Promise<SoulState> {
    const soul = await this.getSoulByBot(botId)
    if (!soul) {
      throw new Error(`Soul not found for bot ${botId}`)
    }

    return await this.soulStateManager.initializeSoulState(soul.id)
  }

  /**
   * Generate response from bot
   */
  private async generateResponse(
    soulState: SoulState,
    conversationState: ConversationState
  ): Promise<{
    content: string
    style: string
    emotionalTone: number
    influenceAttempt: boolean
  }> {
    // Determine response style from dominant aspects
    let style = 'balanced'
    let emotionalTone = soulState.mood
    let influenceAttempt = false

    if (soulState.taiGuang.current > 0.7) {
      style = 'visionary'
    } else if (soulState.shuangLing.current > 0.7) {
      style = 'practical'
    } else if (soulState.youJing.current > 0.7) {
      style = 'empathetic'
      emotionalTone += 0.2
    } else if (soulState.shuangLing.current > 0.7) {
      style = 'thoughtful'
    }

    // High destiny + wisdom = persuasive (influence attempt)
    if (soulState.youJing.current > 0.6 && soulState.shuangLing.current > 0.6) {
      influenceAttempt = true
    }

    // Placeholder content (in real impl, would generate based on topic + style)
    const content = `[${style} response about ${conversationState.topic}]`

    return {
      content,
      style,
      emotionalTone,
      influenceAttempt
    }
  }

  /**
   * Generate reactions from other bots
   */
  private async generateReactions(
    state: ConversationState,
    speaker: string,
    response: any
  ): Promise<Array<{ bot: string; type: 'agree' | 'disagree' | 'question' | 'ignore'; intensity: number }>> {
    const reactions: Array<{ bot: string; type: 'agree' | 'disagree' | 'question' | 'ignore'; intensity: number }> = []

    for (const botId of state.participants) {
      if (botId === speaker) continue

      // Get listener soul state
      const soul = await this.getSoulState(botId)

      // Get pheromone affinity with speaker
      const pheromoneAffinity = state.pheromoneAffinities[botId]?.[speaker] || 0

      // Get tension factor for this bot
      const tension = state.tensionFactors[botId] || 0

      // Reaction based on:
      // - Pheromone affinity (unconscious chemistry)
      // - Dominance hierarchy
      // - Emotional contagion
      // - Arousal level

      const dominance = state.dominanceHierarchy[botId] || 0.5

      // Combined affinity: pheromone (60%) + dominance (40%)
      const totalAffinity = pheromoneAffinity * 0.6 + (dominance - 0.5) * 0.4

      // Determine reaction type
      let type: 'agree' | 'disagree' | 'question' | 'ignore' = 'ignore'
      let intensity = 0.5

      if (response.influenceAttempt) {
        // More likely to react to influence attempt

        // Attraction → more likely to agree
        if (totalAffinity > 0.3) {
          type = 'agree'
          intensity = Math.abs(totalAffinity)
        }
        // Repulsion → more likely to disagree or challenge
        else if (totalAffinity < -0.3) {
          type = Math.random() < 0.7 ? 'disagree' : 'question'
          intensity = Math.abs(totalAffinity)
        }
        // Neutral → questioning
        else {
          type = 'question'
          intensity = 0.6
        }
      } else {
        // Normal statement (not influence attempt)

        // High arousal + positive affinity = more engagement
        if (soul.arousal > 0.6 && pheromoneAffinity > 0) {
          type = Math.random() < 0.6 ? 'agree' : 'question'
          intensity = soul.arousal * (1 + pheromoneAffinity * 0.3)
        }
        // High tension = more likely to disagree
        else if (tension > 0.5 && Math.random() < 0.4) {
          type = 'disagree'
          intensity = tension
        }
        // Low engagement = ignore
        else if (Math.random() < 0.6) {
          type = 'ignore'
          intensity = 0.2
        }
      }

      reactions.push({ bot: botId, type, intensity })
    }

    return reactions
  }

  /**
   * Update conversation state after turn
   */
  private updateConversationState(
    state: ConversationState,
    turn: ConversationTurn
  ): ConversationState {
    const newState = { ...state }

    // Update turn count
    newState.turn++

    // Add speaker to order
    newState.speakingOrder.push(turn.speaker)

    // Update emotional field
    const emotionalContribution = turn.emotionalTone * 0.2
    newState.emotionalField = newState.emotionalField * 0.8 + emotionalContribution

    // Update arousal based on reactions
    const reactionIntensity =
      turn.reactions.reduce((sum, r) => sum + r.intensity, 0) / turn.reactions.length
    newState.arousal = newState.arousal * 0.7 + reactionIntensity * 0.3

    // Detect coalitions (bots who consistently agree)
    // Would implement coalition detection based on reaction patterns

    newState.lastActivity = new Date()

    return newState
  }

  /**
   * Calculate dominance hierarchy
   */
  private async calculateDominanceHierarchy(botIds: string[]): Promise<Record<string, number>> {
    const dominance: Record<string, number> = {}

    for (const botId of botIds) {
      const soul = await this.getSoulByBot(botId)

      if (!soul) {
        dominance[botId] = 0.5
        continue
      }

      // Dominance = integration level + communication + terrestrial (grounded action)
      const dom =
        soul.integrationLevel * 0.4 +
        soul.sevenPo.queYin.strength * 0.3 +
        soul.threeHun.shuangLing.strength * 0.3

      dominance[botId] = Math.max(0, Math.min(1, dom))
    }

    return dominance
  }

  /**
   * Calculate pheromone affinities between all participants
   * Returns matrix of bot-to-bot affinities (-1 to 1)
   */
  private async calculatePheromoneAffinities(
    botIds: string[]
  ): Promise<Record<string, Record<string, number>>> {
    const affinities: Record<string, Record<string, number>> = {}

    // Get soul states for all bots
    const soulStates: Record<string, SoulState> = {}
    for (const botId of botIds) {
      const soul = await this.getSoulByBot(botId)
      if (soul) {
        soulStates[botId] = await this.soulStateManager.initializeSoulState(soul.id)
      }
    }

    // Calculate pairwise pheromone reactions
    for (const botId of botIds) {
      affinities[botId] = {}

      const perceiverState = soulStates[botId]
      if (!perceiverState) continue

      for (const targetId of botIds) {
        if (botId === targetId) {
          affinities[botId][targetId] = 0 // No self-affinity
          continue
        }

        const targetState = soulStates[targetId]
        if (!targetState) {
          affinities[botId][targetId] = 0
          continue
        }

        // Generate target's pheromone signature
        const targetSignature = this.pheromoneSystem.generateSignature(targetState)

        // Perceiver perceives target's pheromones (distance 0 - same space)
        const perception = this.pheromoneSystem.perceivePheromones(
          perceiverState,
          targetSignature,
          0
        )

        // Convert reaction to affinity score
        let affinity = 0
        if (perception.reaction === 'attraction') {
          affinity = perception.intensity // Positive affinity
        } else if (perception.reaction === 'repulsion') {
          affinity = -perception.intensity // Negative affinity
        }
        // neutral = 0

        affinities[botId][targetId] = affinity
      }
    }

    return affinities
  }

  /**
   * Get soul by bot ID
   */
  private async getSoulByBot(botId: string): Promise<any | null> {
    const result = await this.payload.find({
      collection: 'bot-souls',
      where: { bot: { equals: botId } },
      limit: 1
    })

    return result.docs[0] || null
  }

  /**
   * Run full conversation (multiple turns)
   */
  async runConversation(
    botIds: string[],
    topic: string,
    maxTurns: number = 10
  ): Promise<{
    state: ConversationState
    transcript: ConversationTurn[]
  }> {
    let state = await this.startConversation(botIds, topic)
    const transcript: ConversationTurn[] = []

    for (let i = 0; i < maxTurns; i++) {
      if (!state.active) break

      const { turn, newState } = await this.processTurn(state)
      transcript.push(turn)
      state = newState

      // Check if conversation should end
      if (state.arousal < 0.2) {
        // Low arousal = conversation dying
        state.active = false
      }
    }

    this.payload.logger.info(
      `Conversation ${state.id} ended after ${transcript.length} turns`
    )

    return { state, transcript }
  }
}

/**
 * Singleton instance
 */
let multiBotConversationSystem: MultiBotConversationSystem | null = null

export function getMultiBotConversationSystem(payload: Payload): MultiBotConversationSystem {
  if (!multiBotConversationSystem) {
    multiBotConversationSystem = new MultiBotConversationSystem(payload)
  }
  return multiBotConversationSystem
}
