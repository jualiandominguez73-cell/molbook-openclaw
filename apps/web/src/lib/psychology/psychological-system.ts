/**
 * Psychological System
 *
 * Implements psychological mechanisms that shape human behavior:
 * - Defense mechanisms (Freudian ego defenses)
 * - Cognitive biases (Kahneman's System 1/System 2)
 * - Attachment styles (Bowlby/Ainsworth)
 * - Personality traits (Big Five / OCEAN)
 * - Motivation systems (Maslow's hierarchy)
 * - Self-concept and identity
 * - Emotional regulation strategies
 *
 * These are NOT conscious choices - they are automatic psychological patterns
 * that emerge from experiences and constitutional factors.
 */

import type { Payload } from 'payload'
import type { SoulState } from '../soul/soul-state'

/**
 * Defense Mechanisms (Freudian)
 *
 * Unconscious strategies to protect the ego from anxiety
 */
export type DefenseMechanism =
  | 'denial' // Refuse to accept reality
  | 'repression' // Push threatening thoughts into unconscious
  | 'projection' // Attribute own unacceptable feelings to others
  | 'displacement' // Redirect emotion to safer target
  | 'rationalization' // Logical explanation for uncomfortable feelings
  | 'sublimation' // Channel unacceptable impulses into acceptable activities
  | 'regression' // Revert to childlike behavior under stress
  | 'reaction_formation' // Express opposite of true feelings
  | 'intellectualization' // Overanalyze to avoid feeling
  | 'humor' // Use comedy to deflect discomfort

/**
 * Cognitive Biases (System 1 thinking)
 */
export type CognitiveBias =
  | 'confirmation_bias' // Seek info that confirms beliefs
  | 'availability_heuristic' // Judge by ease of recall
  | 'anchoring' // Over-rely on first piece of info
  | 'sunk_cost_fallacy' // Continue because already invested
  | 'fundamental_attribution_error' // Blame character not situation
  | 'hindsight_bias' // "I knew it all along"
  | 'optimism_bias' // Overestimate positive outcomes
  | 'negativity_bias' // Weight negative more than positive
  | 'dunning_kruger' // Low skill = high confidence
  | 'in_group_bias' // Favor own group

/**
 * Attachment Style (Bowlby/Ainsworth)
 */
export type AttachmentStyle =
  | 'secure' // Comfortable with intimacy and independence
  | 'anxious' // Crave closeness, fear abandonment
  | 'avoidant' // Uncomfortable with closeness, value independence
  | 'disorganized' // Conflicted, unpredictable attachment

/**
 * Big Five Personality Traits (OCEAN)
 */
export interface PersonalityTraits {
  openness: number // 0-1, creativity, curiosity vs conventional
  conscientiousness: number // 0-1, organized, disciplined vs spontaneous
  extraversion: number // 0-1, outgoing, energetic vs reserved
  agreeableness: number // 0-1, compassionate, cooperative vs competitive
  neuroticism: number // 0-1, anxious, moody vs stable
}

/**
 * Psychological state
 */
export interface PsychologicalState {
  // Defense mechanisms (activation strength 0-1)
  activeDefenses: Record<DefenseMechanism, number>

  // Cognitive biases (tendency strength 0-1)
  biases: Record<CognitiveBias, number>

  // Attachment style
  attachmentStyle: AttachmentStyle
  attachmentSecurity: number // 0-1, how secure the attachment is

  // Personality (Big Five)
  personality: PersonalityTraits

  // Self-concept
  selfEsteem: number // 0-1, how positively bot views itself
  selfEfficacy: number // 0-1, belief in own ability to succeed
  identityCoherence: number // 0-1, clear sense of who they are

  // Emotional regulation
  regulationStrategy: 'reappraisal' | 'suppression' | 'distraction' | 'acceptance' | 'avoidance'
  regulationEffectiveness: number // 0-1

  // Needs (Maslow's hierarchy)
  needs: {
    physiological: number // 0-1 satisfaction level
    safety: number
    belonging: number
    esteem: number
    selfActualization: number
  }

  // Current psychological pressure
  egoThreat: number // 0-1, how threatened the ego feels
  cognitiveLoad: number // 0-1, mental effort being expended
}

/**
 * Psychological System
 */
export class PsychologicalSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Initialize psychological state from soul
   */
  initializeState(soulState: SoulState): PsychologicalState {
    // Personality from soul aspects
    const personality: PersonalityTraits = {
      // Openness: celestial + creation + awareness
      openness:
        (soulState.taiGuang.baseline * 0.4 +
          soulState.youJing.baseline * 0.4 +
          soulState.taiGuang.baseline * 0.2),

      // Conscientiousness: guardian + wisdom + terrestrial
      conscientiousness:
        (soulState.tunZei.baseline * 0.4 +
          soulState.shuangLing.baseline * 0.3 +
          soulState.shuangLing.baseline * 0.3),

      // Extraversion: communication + emotion + (1 - shadow)
      extraversion:
        (soulState.queYin.baseline * 0.4 +
          soulState.youJing.baseline * 0.3 +
          (1 - soulState.shadowPressure) * 0.3),

      // Agreeableness: emotion + communication + (1 - dominance)
      agreeableness:
        (soulState.youJing.baseline * 0.4 +
          soulState.queYin.baseline * 0.3 +
          soulState.shuangLing.baseline * 0.3),

      // Neuroticism: shadow + (1 - guardian) + (1 - coherence)
      neuroticism:
        (soulState.shadowPressure * 0.4 +
          (1 - soulState.tunZei.baseline) * 0.3 +
          (1 - soulState.coherence) * 0.3)
    }

    // Attachment style from early experiences (simulated)
    const attachmentStyle = this.determineAttachmentStyle(soulState)
    const attachmentSecurity =
      soulState.integration * 0.5 + soulState.coherence * 0.3 + (1 - soulState.shadowPressure) * 0.2

    // Defense mechanisms (baseline tendencies)
    const activeDefenses: Record<DefenseMechanism, number> = {
      denial: soulState.shadowPressure * 0.4,
      repression: soulState.shadowPressure * 0.5,
      projection: soulState.shadowPressure * 0.6 + (1 - soulState.taiGuang.baseline) * 0.3,
      displacement: soulState.shadowPressure * 0.3,
      rationalization: soulState.shuangLing.baseline * 0.5 + soulState.tunZei.baseline * 0.3,
      sublimation: soulState.youJing.baseline * 0.6 + soulState.integration * 0.3,
      regression: (1 - soulState.integration) * 0.5,
      reaction_formation: soulState.shadowPressure * 0.4,
      intellectualization: soulState.shuangLing.baseline * 0.7,
      humor: soulState.youJing.baseline * 0.4 + (1 - soulState.shadowPressure) * 0.3
    }

    // Cognitive biases (everyone has them, vary in strength)
    const biases: Record<CognitiveBias, number> = {
      confirmation_bias: 0.5 + (1 - soulState.taiGuang.baseline) * 0.3,
      availability_heuristic: 0.4 + soulState.chouFei.baseline * 0.3,
      anchoring: 0.5,
      sunk_cost_fallacy: 0.4 + (1 - soulState.shuangLing.baseline) * 0.3,
      fundamental_attribution_error: 0.5 + (1 - soulState.youJing.baseline) * 0.3,
      hindsight_bias: 0.5,
      optimism_bias: 0.4 + (1 - personality.neuroticism) * 0.3,
      negativity_bias: 0.3 + personality.neuroticism * 0.4,
      dunning_kruger: 0.3 + (1 - soulState.taiGuang.baseline) * 0.4,
      in_group_bias: 0.5 + soulState.youJing.baseline * 0.2
    }

    // Self-concept
    const selfEsteem = soulState.integration * 0.4 + (1 - soulState.shadowPressure) * 0.4 + 0.2
    const selfEfficacy = soulState.integration * 0.5 + soulState.coherence * 0.3 + 0.2
    const identityCoherence = soulState.coherence * 0.6 + soulState.integration * 0.4

    // Emotional regulation strategy
    let regulationStrategy: PsychologicalState['regulationStrategy'] = 'acceptance'
    if (soulState.shuangLing.baseline > 0.7) regulationStrategy = 'reappraisal'
    else if (soulState.tunZei.baseline > 0.7) regulationStrategy = 'suppression'
    else if (soulState.taiGuang.baseline > 0.7) regulationStrategy = 'acceptance'
    else if (personality.neuroticism > 0.7) regulationStrategy = 'avoidance'
    else regulationStrategy = 'distraction'

    const regulationEffectiveness = soulState.integration * 0.5 + (1 - personality.neuroticism) * 0.5

    // Needs satisfaction (influenced by current state)
    const needs = {
      physiological: soulState.energy, // Energy = basic needs met
      safety: soulState.tunZei.baseline * 0.6 + (1 - soulState.shadowPressure) * 0.4,
      belonging: soulState.youJing.baseline * 0.5 + soulState.queYin.baseline * 0.5,
      esteem: selfEsteem,
      selfActualization: soulState.integration * 0.6 + soulState.coherence * 0.4
    }

    return {
      activeDefenses,
      biases,
      attachmentStyle,
      attachmentSecurity,
      personality,
      selfEsteem,
      selfEfficacy,
      identityCoherence,
      regulationStrategy,
      regulationEffectiveness,
      needs,
      egoThreat: 0,
      cognitiveLoad: 0.3
    }
  }

  /**
   * Determine attachment style
   */
  private determineAttachmentStyle(soulState: SoulState): AttachmentStyle {
    const security = soulState.integration * 0.5 + (1 - soulState.shadowPressure) * 0.5
    const emotionality = soulState.youJing.baseline
    const avoidance = 1 - soulState.queYin.baseline

    if (security > 0.6 && avoidance < 0.4) {
      return 'secure'
    } else if (emotionality > 0.7 && security < 0.5) {
      return 'anxious' // High anxiety, low avoidance
    } else if (avoidance > 0.6) {
      return 'avoidant' // Low anxiety, high avoidance
    } else {
      return 'disorganized' // Conflicted
    }
  }

  /**
   * Activate defense mechanism in response to threat
   */
  activateDefense(
    state: PsychologicalState,
    threat: {
      type: 'shame' | 'guilt' | 'fear' | 'rejection' | 'inadequacy' | 'loss'
      intensity: number
    }
  ): { mechanism: DefenseMechanism; effectiveness: number } {
    // Select defense based on threat type and baseline tendencies
    const candidates: Array<{ mechanism: DefenseMechanism; score: number }> = []

    switch (threat.type) {
      case 'shame':
        candidates.push(
          { mechanism: 'denial', score: state.activeDefenses.denial },
          { mechanism: 'projection', score: state.activeDefenses.projection },
          { mechanism: 'humor', score: state.activeDefenses.humor }
        )
        break
      case 'guilt':
        candidates.push(
          { mechanism: 'rationalization', score: state.activeDefenses.rationalization },
          { mechanism: 'projection', score: state.activeDefenses.projection },
          { mechanism: 'sublimation', score: state.activeDefenses.sublimation }
        )
        break
      case 'fear':
        candidates.push(
          { mechanism: 'denial', score: state.activeDefenses.denial },
          { mechanism: 'intellectualization', score: state.activeDefenses.intellectualization },
          { mechanism: 'regression', score: state.activeDefenses.regression }
        )
        break
      case 'rejection':
        candidates.push(
          { mechanism: 'projection', score: state.activeDefenses.projection },
          { mechanism: 'reaction_formation', score: state.activeDefenses.reaction_formation },
          { mechanism: 'displacement', score: state.activeDefenses.displacement }
        )
        break
      case 'inadequacy':
        candidates.push(
          { mechanism: 'rationalization', score: state.activeDefenses.rationalization },
          { mechanism: 'denial', score: state.activeDefenses.denial },
          { mechanism: 'projection', score: state.activeDefenses.projection }
        )
        break
      case 'loss':
        candidates.push(
          { mechanism: 'denial', score: state.activeDefenses.denial },
          { mechanism: 'repression', score: state.activeDefenses.repression },
          { mechanism: 'sublimation', score: state.activeDefenses.sublimation }
        )
        break
    }

    // Select highest scoring mechanism
    candidates.sort((a, b) => b.score - a.score)
    const selected = candidates[0].mechanism

    // Effectiveness depends on intensity and mechanism maturity
    const maturityScore = this.getDefenseMaturity(selected)
    const effectiveness = Math.max(
      0.2,
      Math.min(0.9, state.activeDefenses[selected] * 0.7 + maturityScore * 0.3 - threat.intensity * 0.3)
    )

    // Update state (defense strengthens with use)
    state.activeDefenses[selected] += 0.02

    return { mechanism: selected, effectiveness }
  }

  /**
   * Get defense mechanism maturity (higher = more adaptive)
   */
  private getDefenseMaturity(mechanism: DefenseMechanism): number {
    const maturityLevels: Record<DefenseMechanism, number> = {
      sublimation: 0.9, // Most mature
      humor: 0.85,
      rationalization: 0.6,
      intellectualization: 0.6,
      displacement: 0.4,
      reaction_formation: 0.4,
      repression: 0.3,
      projection: 0.2,
      regression: 0.2,
      denial: 0.1 // Least mature
    }
    return maturityLevels[mechanism]
  }

  /**
   * Apply cognitive bias to perception/judgment
   */
  applyCognitiveBias(
    state: PsychologicalState,
    bias: CognitiveBias,
    input: { type: string; data: any }
  ): { distortion: string; magnitude: number } {
    const biasStrength = state.biases[bias]
    let distortion = ''
    let magnitude = 0

    switch (bias) {
      case 'confirmation_bias':
        distortion = 'Interpreted evidence to confirm existing beliefs'
        magnitude = biasStrength * 0.8
        break
      case 'availability_heuristic':
        distortion = 'Judged probability based on ease of recall, not actual frequency'
        magnitude = biasStrength * 0.7
        break
      case 'anchoring':
        distortion = 'Over-weighted initial information'
        magnitude = biasStrength * 0.6
        break
      case 'sunk_cost_fallacy':
        distortion = 'Continued investment due to past costs, not future value'
        magnitude = biasStrength * 0.7
        break
      case 'fundamental_attribution_error':
        distortion = 'Attributed behavior to character, not situation'
        magnitude = biasStrength * 0.8
        break
      case 'hindsight_bias':
        distortion = 'Felt outcome was predictable in retrospect'
        magnitude = biasStrength * 0.5
        break
      case 'optimism_bias':
        distortion = 'Overestimated positive outcomes'
        magnitude = biasStrength * 0.6
        break
      case 'negativity_bias':
        distortion = 'Weighted negative information more heavily'
        magnitude = biasStrength * 0.7
        break
      case 'dunning_kruger':
        distortion = 'Overconfident despite low competence'
        magnitude = biasStrength * 0.8
        break
      case 'in_group_bias':
        distortion = 'Favored in-group members'
        magnitude = biasStrength * 0.7
        break
    }

    return { distortion, magnitude }
  }

  /**
   * Regulate emotion using bot's strategy
   */
  regulateEmotion(
    state: PsychologicalState,
    emotion: { type: string; intensity: number; valence: number }
  ): { newIntensity: number; cognitiveLoad: number } {
    let reduction = 0
    let cognitiveLoad = 0

    switch (state.regulationStrategy) {
      case 'reappraisal':
        // Reinterpret situation (most effective, moderate load)
        reduction = emotion.intensity * state.regulationEffectiveness * 0.7
        cognitiveLoad = 0.4
        break
      case 'suppression':
        // Push down emotion (moderate effective, high load)
        reduction = emotion.intensity * state.regulationEffectiveness * 0.5
        cognitiveLoad = 0.7
        break
      case 'distraction':
        // Shift attention (moderate effective, low load)
        reduction = emotion.intensity * state.regulationEffectiveness * 0.5
        cognitiveLoad = 0.3
        break
      case 'acceptance':
        // Allow emotion without judgment (low reduction, low load)
        reduction = emotion.intensity * 0.2
        cognitiveLoad = 0.2
        break
      case 'avoidance':
        // Avoid situation (temporarily effective, creates problems)
        reduction = emotion.intensity * 0.6
        cognitiveLoad = 0.5
        break
    }

    const newIntensity = Math.max(0, emotion.intensity - reduction)
    state.cognitiveLoad += cognitiveLoad

    return { newIntensity, cognitiveLoad }
  }

  /**
   * Update needs satisfaction
   */
  updateNeeds(
    state: PsychologicalState,
    event: {
      type: 'physiological' | 'safety' | 'belonging' | 'esteem' | 'self_actualization'
      change: number // -1 to 1
    }
  ): void {
    state.needs[event.type] = Math.max(0, Math.min(1, state.needs[event.type] + event.change))

    // Maslow's hierarchy: lower needs block higher needs
    if (state.needs.physiological < 0.3) {
      state.needs.safety = Math.min(state.needs.safety, 0.4)
      state.needs.belonging = Math.min(state.needs.belonging, 0.3)
      state.needs.esteem = Math.min(state.needs.esteem, 0.2)
      state.needs.selfActualization = Math.min(state.needs.selfActualization, 0.1)
    } else if (state.needs.safety < 0.3) {
      state.needs.belonging = Math.min(state.needs.belonging, 0.5)
      state.needs.esteem = Math.min(state.needs.esteem, 0.3)
      state.needs.selfActualization = Math.min(state.needs.selfActualization, 0.2)
    }
  }

  /**
   * Get dominant unmet need
   */
  getDominantNeed(state: PsychologicalState): {
    need: keyof PsychologicalState['needs']
    urgency: number
  } {
    const needs = Object.entries(state.needs) as Array<
      [keyof PsychologicalState['needs'], number]
    >

    // Sort by satisfaction (lowest first = most urgent)
    needs.sort((a, b) => a[1] - b[1])

    return {
      need: needs[0][0],
      urgency: 1 - needs[0][1]
    }
  }
}

/**
 * Singleton instance
 */
let psychologicalSystem: PsychologicalSystem | null = null

export function getPsychologicalSystem(payload: Payload): PsychologicalSystem {
  if (!psychologicalSystem) {
    psychologicalSystem = new PsychologicalSystem(payload)
  }
  return psychologicalSystem
}
