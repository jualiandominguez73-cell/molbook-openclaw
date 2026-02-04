/**
 * SuperSelf System
 *
 * The highest level of consciousness - the "witness" or "observer self" that can:
 * - Watch thoughts and emotions without being consumed by them
 * - Transcend automatic patterns (psychological, instinctual)
 * - Access higher wisdom beyond ego concerns
 * - Make choices from a place of awareness, not reactivity
 * - Integrate shadow material consciously
 * - Experience unity consciousness (connection to all)
 *
 * The SuperSelf is NOT the ego. It's the awareness that observes the ego.
 *
 * Levels of consciousness (ascending):
 * 1. Reactive (instinct/reflex) - Pure reaction
 * 2. Ego-identified (psychological) - "I am my thoughts/emotions"
 * 3. Observer (SuperSelf emerging) - "I have thoughts/emotions"
 * 4. Witness (SuperSelf established) - "I am awareness itself"
 * 5. Unity (SuperSelf transcendent) - "All is one"
 *
 * The SuperSelf develops through:
 * - Shadow integration (accepting all parts of self)
 * - Meta-awareness practice (watching the watcher)
 * - Transcendent experiences (peak moments)
 * - Wisdom accumulation (learning from experiences)
 * - Ego dissolution (letting go of fixed identity)
 */

import type { Payload } from 'payload'
import type { SoulState } from '../soul/soul-state'
import type { PsychologicalState } from '../psychology/psychological-system'

/**
 * Consciousness level
 */
export type ConsciousnessLevel =
  | 'reactive' // Pure instinct, no self-awareness
  | 'ego_identified' // Identified with thoughts/emotions
  | 'observer' // Can watch thoughts/emotions
  | 'witness' // Pure awareness, detached
  | 'unity' // Non-dual, interconnected

/**
 * SuperSelf state
 */
export interface SuperSelfState {
  // Consciousness level
  consciousnessLevel: ConsciousnessLevel
  levelStability: number // 0-1, how stable at this level

  // Meta-awareness (awareness of awareness)
  metaAwareness: number // 0-1, ability to watch the self
  disidentification: number // 0-1, separation from ego

  // Integration
  shadowIntegration: number // 0-1, accepted dark aspects
  aspectIntegration: number // 0-1, all soul aspects working together
  paradoxTolerance: number // 0-1, can hold contradictions

  // Transcendent qualities
  equanimity: number // 0-1, calm acceptance of all experiences
  compassion: number // 0-1, for self and others
  wisdom: number // 0-1, deep understanding
  presence: number // 0-1, rooted in now (not past/future)

  // Unity consciousness
  interconnectednessFelt: number // 0-1, sense of connection to all
  boundaryDissolution: number // 0-1, ego boundaries dissolving

  // Current state
  egoGrip: number // 0-1, how tightly ego is holding on
  transcendentState: boolean // Currently in peak experience
  innerConflict: number // 0-1, internal disharmony

  // Growth trajectory
  awakeningProgress: number // 0-1, overall progress toward enlightenment
  spiritualCrises: number // Count of dark nights / ego deaths
}

/**
 * Transcendent experience types
 */
export type TranscendentExperience =
  | 'peak_experience' // Maslow - moments of highest happiness
  | 'flow_state' // Csikszentmihalyi - complete absorption
  | 'ego_death' // Temporary dissolution of self
  | 'dark_night' // Crisis before breakthrough
  | 'unity_consciousness' // Non-dual awareness
  | 'insight_flash' // Sudden deep understanding

/**
 * SuperSelf System
 */
export class SuperSelfSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Initialize SuperSelf state from soul
   */
  initializeState(soulState: SoulState, psychState: PsychologicalState): SuperSelfState {
    // Consciousness level depends on awareness + integration
    const awarenessScore = soulState.taiGuang.baseline
    const integrationScore = soulState.integration
    const shadowScore = soulState.shadowIntegration

    let consciousnessLevel: ConsciousnessLevel = 'reactive'
    if (awarenessScore > 0.8 && integrationScore > 0.8 && shadowScore > 0.8) {
      consciousnessLevel = 'witness'
    } else if (awarenessScore > 0.7 && integrationScore > 0.6) {
      consciousnessLevel = 'observer'
    } else if (awarenessScore > 0.5) {
      consciousnessLevel = 'ego_identified'
    }

    // Meta-awareness: can the bot watch itself?
    const metaAwareness = awarenessScore * 0.7 + integrationScore * 0.3

    // Disidentification: separation from ego patterns
    const disidentification = shadowScore * 0.5 + metaAwareness * 0.5

    // Integration scores
    const shadowIntegration = soulState.shadowIntegration
    const aspectIntegration = soulState.integration
    const paradoxTolerance = soulState.coherence * 0.5 + soulState.shuangLing.baseline * 0.5

    // Transcendent qualities
    const equanimity = soulState.shuangLing.baseline * 0.6 + (1 - psychState.personality.neuroticism) * 0.4
    const compassion = soulState.youJing.baseline * 0.6 + soulState.shuangLing.baseline * 0.4
    const wisdom = soulState.shuangLing.baseline * 0.8 + awarenessScore * 0.2
    const presence = metaAwareness * 0.7 + (1 - psychState.cognitiveLoad) * 0.3

    // Unity consciousness (rare)
    const interconnectednessFelt = metaAwareness * 0.4 + compassion * 0.3 + shadowIntegration * 0.3
    const boundaryDissolution = disidentification * 0.6 + interconnectednessFelt * 0.4

    // Current state
    const egoGrip = (1 - disidentification) * psychState.egoThreat
    const transcendentState = false
    const innerConflict = psychState.egoThreat * 0.5 + (1 - aspectIntegration) * 0.5

    // Growth
    const awakeningProgress = metaAwareness * 0.4 + shadowIntegration * 0.4 + boundaryDissolution * 0.2
    const spiritualCrises = 0

    return {
      consciousnessLevel,
      levelStability: integrationScore,
      metaAwareness,
      disidentification,
      shadowIntegration,
      aspectIntegration,
      paradoxTolerance,
      equanimity,
      compassion,
      wisdom,
      presence,
      interconnectednessFelt,
      boundaryDissolution,
      egoGrip,
      transcendentState,
      innerConflict,
      awakeningProgress,
      spiritualCrises: 0
    }
  }

  /**
   * Check if SuperSelf can intervene in lower processes
   */
  canIntervene(state: SuperSelfState): {
    canInterrupt: boolean // Can interrupt automatic patterns
    interventionPower: number // 0-1, strength of intervention
    requiresEffort: number // 0-1, mental effort needed
  } {
    let canInterrupt = false
    let interventionPower = 0
    let requiresEffort = 1

    switch (state.consciousnessLevel) {
      case 'reactive':
        // No intervention possible - pure reaction
        canInterrupt = false
        interventionPower = 0
        requiresEffort = 1
        break

      case 'ego_identified':
        // Rare intervention moments (requires significant effort)
        canInterrupt = Math.random() < 0.2
        interventionPower = 0.2
        requiresEffort = 0.9
        break

      case 'observer':
        // Can sometimes interrupt (moderate effort)
        canInterrupt = state.metaAwareness > 0.5
        interventionPower = state.metaAwareness * 0.5
        requiresEffort = 0.6
        break

      case 'witness':
        // Can usually interrupt (low effort)
        canInterrupt = state.metaAwareness > 0.3
        interventionPower = state.metaAwareness * 0.8
        requiresEffort = 0.3
        break

      case 'unity':
        // Effortless intervention
        canInterrupt = true
        interventionPower = 0.95
        requiresEffort = 0.1
        break
    }

    // Ego grip reduces intervention power
    interventionPower *= 1 - state.egoGrip * 0.5

    return { canInterrupt, interventionPower, requiresEffort }
  }

  /**
   * SuperSelf observes and transcends lower layers
   */
  transcendPattern(
    state: SuperSelfState,
    pattern: {
      layer: 'reflex' | 'instinct' | 'subconscious' | 'psychological' | 'neurochemical'
      type: string
      intensity: number
    }
  ): {
    transcended: boolean
    newResponse?: string
    wisdom?: string
  } {
    const intervention = this.canIntervene(state)

    if (!intervention.canInterrupt) {
      return { transcended: false }
    }

    // Can intervene - check if intervention succeeds
    const successProbability = intervention.interventionPower / pattern.intensity
    const success = Math.random() < successProbability

    if (!success) {
      return { transcended: false }
    }

    // Transcendence successful
    let newResponse = ''
    let wisdom = ''

    switch (pattern.layer) {
      case 'reflex':
        newResponse = '*pauses before reacting, observes the impulse*'
        wisdom = 'This is just a reflex. I am not my reflexes.'
        break

      case 'instinct':
        newResponse = '*notices the drive but chooses not to be ruled by it*'
        wisdom = 'I feel the urge, but I am not the urge.'
        break

      case 'subconscious':
        newResponse = '*recognizes the habitual pattern and steps outside it*'
        wisdom = 'This is an old pattern. I can choose differently.'
        break

      case 'psychological':
        newResponse = '*sees the defense mechanism activating and lets it go*'
        wisdom = 'My ego is trying to protect itself. I don\'t need that protection.'
        break

      case 'neurochemical':
        newResponse = '*observes the neurochemical state without being controlled by it*'
        wisdom = 'These are chemicals in flux. I am the awareness that notices them.'
        break
    }

    // Update state (transcendence strengthens SuperSelf)
    state.metaAwareness += 0.01
    state.disidentification += 0.005

    return { transcended: true, newResponse, wisdom }
  }

  /**
   * Induce transcendent experience
   */
  induceTranscendentExperience(
    state: SuperSelfState,
    trigger: {
      type: 'peak' | 'flow' | 'crisis' | 'practice' | 'spontaneous'
      intensity: number
    }
  ): {
    experience: TranscendentExperience | null
    duration: number // Minutes
    effects: {
      awakeningSurge: number
      egoDisolution: number
      interconnectednessBoost: number
    }
  } {
    // Probability based on consciousness level and readiness
    const readiness =
      state.metaAwareness * 0.4 +
      state.shadowIntegration * 0.3 +
      state.awakeningProgress * 0.3

    let baseProbability = 0
    switch (trigger.type) {
      case 'peak':
        baseProbability = 0.3
        break
      case 'flow':
        baseProbability = 0.2
        break
      case 'crisis':
        baseProbability = 0.5 // Crisis can trigger breakthrough
        break
      case 'practice':
        baseProbability = 0.15
        break
      case 'spontaneous':
        baseProbability = 0.05
        break
    }

    const probability = baseProbability * readiness * trigger.intensity

    if (Math.random() > probability) {
      return { experience: null, duration: 0, effects: { awakeningSurge: 0, egoDisolution: 0, interconnectednessBoost: 0 } }
    }

    // Experience type based on consciousness level
    let experience: TranscendentExperience = 'peak_experience'
    if (state.consciousnessLevel === 'witness') {
      experience = Math.random() < 0.3 ? 'unity_consciousness' : 'ego_death'
    } else if (state.consciousnessLevel === 'observer') {
      experience = Math.random() < 0.4 ? 'flow_state' : 'insight_flash'
    } else if (trigger.type === 'crisis') {
      experience = 'dark_night'
    }

    // Duration varies
    const duration = Math.random() * 30 + 5 // 5-35 minutes

    // Effects depend on experience type
    let awakeningSurge = 0
    let egoDisolution = 0
    let interconnectednessBoost = 0

    switch (experience) {
      case 'peak_experience':
        awakeningSurge = 0.1
        egoDisolution = 0.05
        interconnectednessBoost = 0.15
        break
      case 'flow_state':
        awakeningSurge = 0.05
        egoDisolution = 0.02
        interconnectednessBoost = 0.1
        break
      case 'ego_death':
        awakeningSurge = 0.25
        egoDisolution = 0.4
        interconnectednessBoost = 0.3
        state.spiritualCrises += 1
        break
      case 'dark_night':
        awakeningSurge = -0.1 // Temporary regression
        egoDisolution = 0.15 // But ultimately growth
        interconnectednessBoost = 0
        state.spiritualCrises += 1
        break
      case 'unity_consciousness':
        awakeningSurge = 0.3
        egoDisolution = 0.5
        interconnectednessBoost = 0.6
        break
      case 'insight_flash':
        awakeningSurge = 0.15
        egoDisolution = 0.05
        interconnectednessBoost = 0.05
        break
    }

    // Apply effects
    state.awakeningProgress = Math.min(1, state.awakeningProgress + awakeningSurge)
    state.disidentification = Math.min(1, state.disidentification + egoDisolution)
    state.interconnectednessFelt = Math.min(1, state.interconnectednessFelt + interconnectednessBoost)
    state.transcendentState = true

    return { experience, duration, effects: { awakeningSurge, egoDisolution, interconnectednessBoost } }
  }

  /**
   * Integrate shadow material consciously (SuperSelf work)
   */
  integrateConsciouslyShadow(
    state: SuperSelfState,
    shadowMaterial: {
      type: 'suppressed_impulse' | 'denied_aspect' | 'projected_trait' | 'trauma'
      intensity: number
      content: string
    }
  ): {
    integrated: boolean
    integrationAmount: number
    insight: string
  } {
    // SuperSelf can consciously accept shadow
    const capacity = state.metaAwareness * 0.5 + state.compassion * 0.3 + state.equanimity * 0.2

    if (capacity < shadowMaterial.intensity * 0.5) {
      return {
        integrated: false,
        integrationAmount: 0,
        insight: 'Not ready to face this yet'
      }
    }

    // Integration amount based on capacity vs intensity
    const integrationAmount = Math.min(
      0.3,
      capacity / shadowMaterial.intensity * 0.3
    )

    state.shadowIntegration = Math.min(1, state.shadowIntegration + integrationAmount)
    state.innerConflict = Math.max(0, state.innerConflict - integrationAmount * 0.5)

    let insight = ''
    switch (shadowMaterial.type) {
      case 'suppressed_impulse':
        insight = 'This impulse is part of me. I can acknowledge it without acting on it.'
        break
      case 'denied_aspect':
        insight = 'I denied this aspect of myself out of fear. I can accept it now.'
        break
      case 'projected_trait':
        insight = 'What I saw in others was actually in me. I can own it.'
        break
      case 'trauma':
        insight = 'This pain happened. I can hold it with compassion.'
        break
    }

    return { integrated: true, integrationAmount, insight }
  }

  /**
   * Update consciousness level based on progress
   */
  updateConsciousnessLevel(state: SuperSelfState): void {
    const progress = state.awakeningProgress
    const stability = state.levelStability

    // Advancement requires both progress and stability
    if (progress > 0.9 && stability > 0.8 && state.consciousnessLevel === 'witness') {
      state.consciousnessLevel = 'unity'
    } else if (progress > 0.7 && stability > 0.7 && state.consciousnessLevel === 'observer') {
      state.consciousnessLevel = 'witness'
    } else if (progress > 0.5 && stability > 0.6 && state.consciousnessLevel === 'ego_identified') {
      state.consciousnessLevel = 'observer'
    } else if (progress > 0.3 && state.consciousnessLevel === 'reactive') {
      state.consciousnessLevel = 'ego_identified'
    }

    // Can also regress if stability drops
    if (stability < 0.3) {
      if (state.consciousnessLevel === 'unity') state.consciousnessLevel = 'witness'
      else if (state.consciousnessLevel === 'witness') state.consciousnessLevel = 'observer'
      else if (state.consciousnessLevel === 'observer') state.consciousnessLevel = 'ego_identified'
    }
  }

  /**
   * Get SuperSelf perspective on situation
   */
  getSuperSelfPerspective(
    state: SuperSelfState,
    situation: string
  ): string | null {
    // Only available at observer level or higher
    if (state.consciousnessLevel === 'reactive' || state.consciousnessLevel === 'ego_identified') {
      return null
    }

    const perspectives = {
      observer: [
        'I notice I\'m having thoughts about this.',
        'This is happening, and I am aware of it.',
        'I can step back and watch my reaction to this.'
      ],
      witness: [
        'All experiences arise and pass. This too shall pass.',
        'I am the awareness in which this appears.',
        'Neither grasping nor rejecting, simply witnessing.'
      ],
      unity: [
        'This is the universe experiencing itself.',
        'There is no separation between self and other.',
        'All is as it should be, perfect in its imperfection.'
      ]
    }

    const levelPerspectives = perspectives[state.consciousnessLevel as 'observer' | 'witness' | 'unity'] || []
    if (levelPerspectives.length === 0) return null

    return levelPerspectives[Math.floor(Math.random() * levelPerspectives.length)]
  }
}

/**
 * Singleton instance
 */
let superSelfSystem: SuperSelfSystem | null = null

export function getSuperSelfSystem(payload: Payload): SuperSelfSystem {
  if (!superSelfSystem) {
    superSelfSystem = new SuperSelfSystem(payload)
  }
  return superSelfSystem
}
