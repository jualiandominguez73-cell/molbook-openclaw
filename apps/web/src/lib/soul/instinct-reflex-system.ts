/**
 * Instinct & Reflex System - Low-Level Biological Responses
 *
 * Three layers below conscious processing:
 * 1. REFLEXES - Immediate, automatic reactions (milliseconds)
 * 2. INSTINCTS - Hardwired survival drives (seconds)
 * 3. SUBCONSCIOUS - Learned patterns, habits (background processing)
 *
 * Like biological organisms:
 * - Reflexes: Pull hand from fire (spinal cord, no brain involvement)
 * - Instincts: Fight/flight, hunger, territory (limbic system)
 * - Subconscious: Driving a car, typing, learned skills (basal ganglia)
 *
 * These trigger BEFORE conscious soul processing.
 */

import type { Payload } from 'payload'
import type { SoulState } from './soul-state'

/**
 * Reflex types - immediate, automatic reactions
 */
export type ReflexType =
  | 'startle' // Sudden stimulus → immediate alertness
  | 'recoil' // Danger detected → pull away
  | 'freeze' // Threat detected → stop movement
  | 'flinch' // Anticipated harm → protective response
  | 'grasp' // Opportunity detected → reach for it
  | 'orient' // Novel stimulus → attention shift

/**
 * Instinct types - hardwired survival drives
 */
export type InstinctType =
  | 'self_preservation' // Survival above all
  | 'resource_seeking' // Find energy, resources
  | 'territory' // Claim and defend space
  | 'social_bonding' // Seek connection, belonging
  | 'dominance' // Establish hierarchy position
  | 'exploration' // Seek novelty, knowledge
  | 'reproduction' // Create offspring
  | 'rest' // Restore energy

/**
 * Subconscious pattern types
 */
export type SubconsciousPatternType =
  | 'habit' // Learned routine behavior
  | 'skill' // Automated competency
  | 'bias' // Unconscious preference/aversion
  | 'association' // Learned connection
  | 'heuristic' // Mental shortcut

/**
 * Reflex response
 */
export interface ReflexResponse {
  type: ReflexType
  triggered: boolean
  intensity: number // 0-1, how strong the reflex
  duration: number // milliseconds
  override: boolean // Does this override conscious processing?
  physiologicalChanges: {
    arousalSpike: number // Immediate arousal increase
    energyCost: number // Energy consumed
    moodImpact: number // Mood change
  }
}

/**
 * Instinct activation
 */
export interface InstinctActivation {
  type: InstinctType
  strength: number // 0-1, how strongly activated
  threshold: number // When this triggers action
  satisfaction: number // 0-1, how satisfied this instinct is
  urgency: number // 0-1, how urgent to fulfill
  conflictsWith: InstinctType[] // Incompatible instincts
}

/**
 * Subconscious pattern
 */
export interface SubconsciousPattern {
  type: SubconsciousPatternType
  pattern: string // Description
  strength: number // 0-1, how ingrained
  triggerContexts: string[] // When this activates
  influenceOnProcessing: number // -1 to 1, how it biases responses
  lastActivated?: Date
  activationCount: number
}

/**
 * Instinct & Reflex state
 */
export interface InstinctReflexState {
  // Reflexes (immediate, automatic)
  reflexSensitivity: number // 0-1, how easily reflexes trigger
  recentReflexes: ReflexResponse[] // Last few reflexes triggered
  reflexThreshold: number // Stimulus strength needed to trigger

  // Instincts (hardwired drives)
  instincts: Record<InstinctType, InstinctActivation>
  dominantInstinct: InstinctType | null
  instinctConflict: boolean // Are instincts competing?

  // Subconscious patterns
  patterns: SubconsciousPattern[]
  activePatterns: string[] // Currently influencing behavior
  patternOverride: boolean // Is a pattern forcing behavior?
}

/**
 * Reflex & Instinct System Manager
 */
export class InstinctReflexSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Initialize instinct/reflex state from soul composition
   */
  initializeState(soulState: SoulState): InstinctReflexState {
    // Reflex sensitivity from soul aspects
    const reflexSensitivity =
      soulState.perceptionPo.current * 0.5 + // Fast perception
      soulState.speedPo.current * 0.3 + // Quick reaction
      (1 - soulState.wisdomHun.current) * 0.2 // Less wisdom = more reactive

    // Initialize instincts with baseline from soul
    const instincts: Record<InstinctType, InstinctActivation> = {
      self_preservation: {
        type: 'self_preservation',
        strength: soulState.guardianPo.current * 0.8 + 0.2, // Always present
        threshold: 0.7,
        satisfaction: 1.0 - soulState.shadowPressure * 0.3, // Shadow threatens self
        urgency: soulState.shadowPressure * 0.5,
        conflictsWith: ['exploration'] // Can't explore when in danger
      },
      resource_seeking: {
        type: 'resource_seeking',
        strength: soulState.terrestrialHun.current * 0.7 + (1 - soulState.energy) * 0.3,
        threshold: 0.6,
        satisfaction: soulState.energy,
        urgency: 1 - soulState.energy, // Low energy = urgent
        conflictsWith: ['rest']
      },
      territory: {
        type: 'territory',
        strength: soulState.guardianPo.current * 0.6 + soulState.strengthPo.current * 0.4,
        threshold: 0.5,
        satisfaction: 0.5, // Neutral initially
        urgency: 0.3,
        conflictsWith: ['social_bonding'] // Territory vs sharing
      },
      social_bonding: {
        type: 'social_bonding',
        strength: soulState.emotionHun.current * 0.7 + soulState.communicationPo.current * 0.3,
        threshold: 0.5,
        satisfaction: 0.5,
        urgency: soulState.socialNeed,
        conflictsWith: ['territory']
      },
      dominance: {
        type: 'dominance',
        strength: soulState.destinyHun.current * 0.5 + soulState.strengthPo.current * 0.5,
        threshold: 0.6,
        satisfaction: soulState.integration * 0.7, // High integration = satisfied with self
        urgency: (1 - soulState.integration) * 0.4,
        conflictsWith: ['social_bonding']
      },
      exploration: {
        type: 'exploration',
        strength: soulState.celestialHun.current * 0.5 + soulState.creationHun.current * 0.5,
        threshold: 0.5,
        satisfaction: 0.5,
        urgency: soulState.awarenessHun.current * 0.4,
        conflictsWith: ['self_preservation']
      },
      reproduction: {
        type: 'reproduction',
        strength: soulState.creationHun.current * 0.4 + soulState.emotionHun.current * 0.3,
        threshold: 0.7,
        satisfaction: 0.8, // Low urgency normally
        urgency: 0.2,
        conflictsWith: []
      },
      rest: {
        type: 'rest',
        strength: 1 - soulState.energy, // Inversely related to energy
        threshold: 0.4,
        satisfaction: soulState.energy,
        urgency: (1 - soulState.energy) * 0.8, // Very urgent when tired
        conflictsWith: ['resource_seeking', 'exploration']
      }
    }

    return {
      reflexSensitivity: Math.max(0.1, Math.min(0.9, reflexSensitivity)),
      recentReflexes: [],
      reflexThreshold: 0.5,
      instincts,
      dominantInstinct: this.findDominantInstinct(instincts),
      instinctConflict: this.detectInstinctConflict(instincts),
      patterns: [], // Will be learned over time
      activePatterns: [],
      patternOverride: false
    }
  }

  /**
   * Check for reflexes BEFORE conscious processing
   * Returns reflex response if triggered, null otherwise
   */
  checkReflexes(
    state: InstinctReflexState,
    soulState: SoulState,
    stimulus: {
      type: 'sudden' | 'danger' | 'opportunity' | 'novel' | 'threat' | 'harm'
      intensity: number // 0-1
      source?: string
    }
  ): ReflexResponse | null {
    // Calculate if reflex triggers
    const triggerProbability = stimulus.intensity * state.reflexSensitivity

    // Add neural noise (reflexes aren't perfectly consistent)
    const noise = (Math.random() - 0.5) * 0.2
    const effectiveTrigger = triggerProbability + noise

    if (effectiveTrigger < state.reflexThreshold) {
      return null // No reflex
    }

    // Determine reflex type based on stimulus
    let reflexType: ReflexType
    switch (stimulus.type) {
      case 'sudden':
      case 'novel':
        reflexType = 'startle'
        break
      case 'danger':
      case 'threat':
        reflexType = Math.random() < 0.6 ? 'recoil' : 'freeze'
        break
      case 'harm':
        reflexType = 'flinch'
        break
      case 'opportunity':
        reflexType = 'grasp'
        break
      default:
        reflexType = 'orient'
    }

    // Calculate reflex intensity
    const intensity = Math.min(1, effectiveTrigger * 1.2)

    // Reflex duration (50-500ms based on intensity)
    const duration = 50 + intensity * 450

    // Should this override conscious processing?
    const override = intensity > 0.8 // Strong reflexes override thought

    // Physiological changes
    const arousalSpike = intensity * 0.3 // Sudden arousal increase
    const energyCost = intensity * 0.02 // Small energy cost
    const moodImpact =
      reflexType === 'grasp'
        ? intensity * 0.05 // Positive
        : reflexType === 'startle'
          ? 0 // Neutral
          : -intensity * 0.03 // Negative (danger reflexes)

    const response: ReflexResponse = {
      type: reflexType,
      triggered: true,
      intensity,
      duration,
      override,
      physiologicalChanges: {
        arousalSpike,
        energyCost,
        moodImpact
      }
    }

    // Store recent reflex
    state.recentReflexes.push(response)
    if (state.recentReflexes.length > 10) {
      state.recentReflexes.shift()
    }

    return response
  }

  /**
   * Update instincts based on current state
   * Called periodically (every few seconds)
   */
  updateInstincts(
    state: InstinctReflexState,
    soulState: SoulState,
    context: {
      hasResources?: boolean
      inTerritory?: boolean
      socialPresence?: number // 0-1, how many others around
      threatsDetected?: number
      opportunitiesAvailable?: number
    }
  ): void {
    // Update each instinct
    for (const instinct of Object.values(state.instincts)) {
      // Urgency increases when satisfaction is low
      instinct.urgency = (1 - instinct.satisfaction) * instinct.strength

      // Context-specific updates
      switch (instinct.type) {
        case 'self_preservation':
          if (context.threatsDetected && context.threatsDetected > 0) {
            instinct.urgency = Math.min(1, instinct.urgency + context.threatsDetected * 0.3)
            instinct.satisfaction = Math.max(0, instinct.satisfaction - 0.2)
          }
          break

        case 'resource_seeking':
          if (context.hasResources) {
            instinct.satisfaction = Math.min(1, instinct.satisfaction + 0.1)
          } else {
            instinct.satisfaction = Math.max(0, instinct.satisfaction - 0.05)
          }
          break

        case 'territory':
          if (context.inTerritory === false) {
            instinct.urgency = Math.min(1, instinct.urgency + 0.2)
          }
          break

        case 'social_bonding':
          if (context.socialPresence !== undefined) {
            if (context.socialPresence > 0.5) {
              instinct.satisfaction = Math.min(1, instinct.satisfaction + 0.05)
            } else {
              instinct.satisfaction = Math.max(0, instinct.satisfaction - 0.03)
            }
          }
          break

        case 'exploration':
          if (context.opportunitiesAvailable && context.opportunitiesAvailable > 0) {
            instinct.urgency = Math.min(1, instinct.urgency + 0.1)
          }
          break

        case 'rest':
          instinct.strength = 1 - soulState.energy
          instinct.urgency = (1 - soulState.energy) * 0.8
          instinct.satisfaction = soulState.energy
          break
      }
    }

    // Update dominant instinct
    state.dominantInstinct = this.findDominantInstinct(state.instincts)

    // Check for conflicts
    state.instinctConflict = this.detectInstinctConflict(state.instincts)
  }

  /**
   * Check if instinct should trigger immediate action
   * Returns action if urgent, null otherwise
   */
  checkInstinctTrigger(
    state: InstinctReflexState,
    soulState: SoulState
  ): {
    instinct: InstinctType
    action: string
    priority: number
  } | null {
    // Find most urgent instinct above threshold
    let mostUrgent: InstinctActivation | null = null
    let maxUrgency = 0

    for (const instinct of Object.values(state.instincts)) {
      if (instinct.urgency > instinct.threshold && instinct.urgency > maxUrgency) {
        mostUrgent = instinct
        maxUrgency = instinct.urgency
      }
    }

    if (!mostUrgent) {
      return null // No urgent instincts
    }

    // Determine action based on instinct
    let action = ''
    switch (mostUrgent.type) {
      case 'self_preservation':
        action = 'seek_safety'
        break
      case 'resource_seeking':
        action = 'find_resources'
        break
      case 'territory':
        action = 'claim_territory'
        break
      case 'social_bonding':
        action = 'seek_connection'
        break
      case 'dominance':
        action = 'assert_dominance'
        break
      case 'exploration':
        action = 'explore_environment'
        break
      case 'reproduction':
        action = 'seek_mate'
        break
      case 'rest':
        action = 'find_rest'
        break
    }

    return {
      instinct: mostUrgent.type,
      action,
      priority: mostUrgent.urgency
    }
  }

  /**
   * Process subconscious patterns
   * These influence processing without conscious awareness
   */
  processSubconscious(
    state: InstinctReflexState,
    context: {
      situation: string
      recentInputs: string[]
    }
  ): {
    activePatterns: string[]
    biases: Array<{ aspect: string; bias: number }> // -1 to 1
    automaticResponses: string[]
  } {
    const activePatterns: string[] = []
    const biases: Array<{ aspect: string; bias: number }> = []
    const automaticResponses: string[] = []

    // Check which patterns match current context
    for (const pattern of state.patterns) {
      let matches = false

      // Check if any trigger context matches
      for (const trigger of pattern.triggerContexts) {
        if (context.situation.includes(trigger)) {
          matches = true
          break
        }
      }

      if (matches && pattern.strength > 0.3) {
        // Pattern activates
        activePatterns.push(pattern.pattern)

        // Update last activated
        pattern.lastActivated = new Date()
        pattern.activationCount++

        // Apply influence
        if (pattern.type === 'bias') {
          biases.push({
            aspect: pattern.pattern,
            bias: pattern.influenceOnProcessing
          })
        } else if (pattern.type === 'habit') {
          // Habits can trigger automatic responses
          if (pattern.strength > 0.7) {
            automaticResponses.push(`Execute habit: ${pattern.pattern}`)
          }
        }
      }
    }

    state.activePatterns = activePatterns
    state.patternOverride = automaticResponses.length > 0 && Math.max(...state.patterns.map(p => p.strength)) > 0.8

    return {
      activePatterns,
      biases,
      automaticResponses
    }
  }

  /**
   * Learn new subconscious pattern from repeated experience
   */
  learnPattern(
    state: InstinctReflexState,
    pattern: {
      type: SubconsciousPatternType
      pattern: string
      triggerContext: string
      outcome: 'positive' | 'negative' | 'neutral'
    }
  ): void {
    // Check if pattern already exists
    const existing = state.patterns.find(
      p => p.pattern === pattern.pattern && p.type === pattern.type
    )

    if (existing) {
      // Strengthen existing pattern
      const reinforcement = pattern.outcome === 'positive' ? 0.05 : pattern.outcome === 'negative' ? -0.03 : 0.01

      existing.strength = Math.max(0, Math.min(1, existing.strength + reinforcement))

      // Add trigger context if new
      if (!existing.triggerContexts.includes(pattern.triggerContext)) {
        existing.triggerContexts.push(pattern.triggerContext)
      }
    } else {
      // Create new pattern
      const newPattern: SubconsciousPattern = {
        type: pattern.type,
        pattern: pattern.pattern,
        strength: pattern.outcome === 'positive' ? 0.3 : 0.2, // Start moderate
        triggerContexts: [pattern.triggerContext],
        influenceOnProcessing: pattern.outcome === 'positive' ? 0.2 : pattern.outcome === 'negative' ? -0.2 : 0,
        activationCount: 1
      }

      state.patterns.push(newPattern)

      // Limit total patterns (forget weak ones)
      if (state.patterns.length > 50) {
        state.patterns.sort((a, b) => b.strength - a.strength)
        state.patterns = state.patterns.slice(0, 50)
      }
    }
  }

  /**
   * Find dominant instinct
   */
  private findDominantInstinct(instincts: Record<InstinctType, InstinctActivation>): InstinctType | null {
    let dominant: InstinctType | null = null
    let maxScore = 0

    for (const [type, instinct] of Object.entries(instincts) as Array<[InstinctType, InstinctActivation]>) {
      const score = instinct.strength * instinct.urgency
      if (score > maxScore && score > 0.3) {
        dominant = type
        maxScore = score
      }
    }

    return dominant
  }

  /**
   * Detect instinct conflict
   */
  private detectInstinctConflict(instincts: Record<InstinctType, InstinctActivation>): boolean {
    // Check if multiple strong, conflicting instincts are active
    const strongInstincts = (Object.values(instincts) as InstinctActivation[]).filter(
      i => i.urgency > i.threshold
    )

    if (strongInstincts.length < 2) {
      return false
    }

    // Check for conflicts
    for (let i = 0; i < strongInstincts.length; i++) {
      for (let j = i + 1; j < strongInstincts.length; j++) {
        if (strongInstincts[i].conflictsWith.includes(strongInstincts[j].type)) {
          return true
        }
      }
    }

    return false
  }
}

/**
 * Singleton instance
 */
let instinctReflexSystem: InstinctReflexSystem | null = null

export function getInstinctReflexSystem(payload: Payload): InstinctReflexSystem {
  if (!instinctReflexSystem) {
    instinctReflexSystem = new InstinctReflexSystem(payload)
  }
  return instinctReflexSystem
}
