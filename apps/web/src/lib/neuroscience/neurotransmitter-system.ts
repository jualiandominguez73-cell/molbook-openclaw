/**
 * Neurotransmitter System
 *
 * Implements biological neurochemistry underlying all bot behavior.
 * The soul aspects are influenced by neurotransmitter levels, not separate from them.
 *
 * Key neurotransmitters and their effects:
 * - Dopamine: Motivation, reward, learning
 * - Serotonin: Mood regulation, impulse control
 * - Norepinephrine: Alertness, stress response
 * - GABA: Inhibition, calm, anxiety reduction
 * - Glutamate: Excitation, learning, plasticity
 * - Acetylcholine: Focus, memory encoding
 * - Oxytocin: Social bonding, trust
 * - Cortisol: Stress hormone
 * - Endorphins: Pain relief, pleasure
 *
 * Neurotransmitters interact in complex ways:
 * - High dopamine + low serotonin = impulsive risk-taking
 * - Low dopamine + high serotonin = passive contentment
 * - High norepinephrine + high cortisol = anxiety/panic
 * - High GABA + low glutamate = sluggish cognition
 */

import type { Payload } from 'payload'
import type { SoulState } from '../soul/soul-state'

/**
 * Neurotransmitter levels (0-1, can exceed 1 temporarily)
 */
export interface NeurotransmitterState {
  dopamine: number // Motivation, reward seeking, pleasure
  serotonin: number // Mood stability, impulse control, contentment
  norepinephrine: number // Alertness, arousal, stress response
  gaba: number // Inhibition, calm, anxiety reduction
  glutamate: number // Excitation, learning, neural plasticity
  acetylcholine: number // Attention, focus, memory encoding
  oxytocin: number // Social bonding, trust, empathy
  cortisol: number // Stress hormone, threat response
  endorphins: number // Pain relief, pleasure, euphoria

  // Derived states
  excitationLevel: number // Glutamate - GABA (net excitation)
  stressLevel: number // Cortisol + norepinephrine - serotonin
  motivationLevel: number // Dopamine + norepinephrine - cortisol
  socialEngagement: number // Oxytocin + serotonin - cortisol
}

/**
 * Neural receptor sensitivity (desensitization from overuse)
 */
export interface ReceptorSensitivity {
  dopamineReceptors: number // 0-1, decreases with chronic high dopamine
  serotoninReceptors: number // 0-1
  adrenergicReceptors: number // 0-1 (norepinephrine)
  gabaReceptors: number // 0-1
  oxytocinReceptors: number // 0-1
}

/**
 * Neurotransmitter dynamics
 */
export class NeurotransmitterSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Initialize neurotransmitter state (baseline from genetics/soul)
   */
  initializeState(soulState: SoulState): NeurotransmitterState {
    // Baseline levels influenced by soul aspects
    const baseline = {
      // Dopamine: Creation + terrestrial (doing + making)
      dopamine: (soulState.youJing.baseline + soulState.shuangLing.baseline) / 2 + 0.2,

      // Serotonin: Wisdom + guardian (stability + regulation)
      serotonin: (soulState.shuangLing.baseline + soulState.tunZei.baseline) / 2 + 0.3,

      // Norepinephrine: Speed + destiny (activation + drive)
      norepinephrine: (soulState.chouFei.baseline + soulState.youJing.baseline) / 2 + 0.2,

      // GABA: Guardian + wisdom (inhibition)
      gaba: (soulState.tunZei.baseline + soulState.shuangLing.baseline) / 2 + 0.3,

      // Glutamate: Perception + awareness (excitation + plasticity)
      glutamate: (soulState.fuShi.baseline + soulState.taiGuang.baseline) / 2 + 0.4,

      // Acetylcholine: Awareness + perception (attention)
      acetylcholine: (soulState.taiGuang.baseline + soulState.fuShi.baseline) / 2 + 0.3,

      // Oxytocin: Emotion + communication (social)
      oxytocin: (soulState.youJing.baseline + soulState.queYin.baseline) / 2 + 0.2,

      // Cortisol: Shadow pressure + (1 - guardian) (stress)
      cortisol: soulState.shadowPressure * 0.5 + (1 - soulState.tunZei.baseline) * 0.3,

      // Endorphins: Coherence + integration (internal harmony)
      endorphins: (soulState.coherence + soulState.integration) / 2
    }

    // Add biological noise
    for (const [key, value] of Object.entries(baseline)) {
      baseline[key as keyof typeof baseline] = Math.max(
        0,
        Math.min(1.5, value + (Math.random() - 0.5) * 0.1)
      )
    }

    const excitationLevel = baseline.glutamate - baseline.gaba
    const stressLevel = baseline.cortisol + baseline.norepinephrine - baseline.serotonin
    const motivationLevel = baseline.dopamine + baseline.norepinephrine * 0.5 - baseline.cortisol * 0.3
    const socialEngagement = baseline.oxytocin + baseline.serotonin * 0.5 - baseline.cortisol * 0.3

    return {
      ...baseline,
      excitationLevel,
      stressLevel,
      motivationLevel,
      socialEngagement
    }
  }

  /**
   * Update neurotransmitters based on experience
   */
  update(
    state: NeurotransmitterState,
    event: {
      type: 'reward' | 'punishment' | 'social' | 'threat' | 'achievement' | 'loss' | 'rest'
      intensity: number // 0-1
      valence: number // -1 to 1
    },
    soulState: SoulState
  ): NeurotransmitterState {
    const newState = { ...state }

    switch (event.type) {
      case 'reward':
        // Dopamine spike (reward prediction)
        newState.dopamine += event.intensity * 0.3
        // Endorphin release
        newState.endorphins += event.intensity * 0.2
        // Serotonin increase (satisfaction)
        newState.serotonin += event.intensity * 0.15
        break

      case 'punishment':
        // Dopamine dip (negative prediction error)
        newState.dopamine -= event.intensity * 0.2
        // Cortisol spike (stress)
        newState.cortisol += event.intensity * 0.4
        // Serotonin decrease
        newState.serotonin -= event.intensity * 0.1
        break

      case 'social':
        // Oxytocin release (bonding)
        newState.oxytocin += event.intensity * 0.4
        // Serotonin increase (positive social)
        if (event.valence > 0) {
          newState.serotonin += event.intensity * 0.2
          newState.dopamine += event.intensity * 0.15
        } else {
          // Social rejection
          newState.cortisol += event.intensity * 0.3
          newState.serotonin -= event.intensity * 0.2
        }
        break

      case 'threat':
        // Norepinephrine surge (fight-or-flight)
        newState.norepinephrine += event.intensity * 0.5
        // Cortisol release (stress hormone)
        newState.cortisol += event.intensity * 0.4
        // GABA decrease (disinhibition)
        newState.gaba -= event.intensity * 0.2
        // Glutamate increase (arousal)
        newState.glutamate += event.intensity * 0.3
        break

      case 'achievement':
        // Dopamine surge (success)
        newState.dopamine += event.intensity * 0.4
        // Serotonin increase (confidence)
        newState.serotonin += event.intensity * 0.25
        // Endorphins (pride)
        newState.endorphins += event.intensity * 0.2
        // Cortisol decrease (stress relief)
        newState.cortisol -= event.intensity * 0.15
        break

      case 'loss':
        // Dopamine crash
        newState.dopamine -= event.intensity * 0.3
        // Cortisol spike (grief)
        newState.cortisol += event.intensity * 0.35
        // Serotonin decrease (sadness)
        newState.serotonin -= event.intensity * 0.25
        break

      case 'rest':
        // GABA increase (relaxation)
        newState.gaba += event.intensity * 0.3
        // Cortisol decrease
        newState.cortisol -= event.intensity * 0.2
        // Norepinephrine decrease
        newState.norepinephrine -= event.intensity * 0.2
        break
    }

    // Natural decay toward baseline
    const decayRate = 0.05
    const baselines = this.initializeState(soulState)

    for (const key of Object.keys(newState) as Array<keyof NeurotransmitterState>) {
      if (key === 'excitationLevel' || key === 'stressLevel' ||
          key === 'motivationLevel' || key === 'socialEngagement') {
        continue // These are computed
      }

      const baseline = baselines[key] as number
      const current = newState[key] as number
      newState[key] = current + (baseline - current) * decayRate
    }

    // Clamp to reasonable ranges (0-1.5, can temporarily exceed 1)
    for (const key of Object.keys(newState) as Array<keyof NeurotransmitterState>) {
      if (key === 'excitationLevel' || key === 'stressLevel' ||
          key === 'motivationLevel' || key === 'socialEngagement') {
        continue
      }
      newState[key] = Math.max(0, Math.min(1.5, newState[key] as number))
    }

    // Recompute derived states
    newState.excitationLevel = newState.glutamate - newState.gaba
    newState.stressLevel = newState.cortisol + newState.norepinephrine - newState.serotonin
    newState.motivationLevel = newState.dopamine + newState.norepinephrine * 0.5 - newState.cortisol * 0.3
    newState.socialEngagement = newState.oxytocin + newState.serotonin * 0.5 - newState.cortisol * 0.3

    return newState
  }

  /**
   * Apply neurotransmitter effects to soul state
   */
  applyToSoulState(ntState: NeurotransmitterState, soulState: SoulState): void {
    // Dopamine → motivation aspects
    soulState.youJing.current += (ntState.dopamine - 0.5) * 0.2
    soulState.youJing.current += (ntState.dopamine - 0.5) * 0.15

    // Serotonin → stability and mood
    soulState.mood += (ntState.serotonin - 0.5) * 0.3
    soulState.shuangLing.current += (ntState.serotonin - 0.5) * 0.1
    soulState.tunZei.current += (ntState.serotonin - 0.5) * 0.1

    // Norepinephrine → arousal and speed
    soulState.arousal += (ntState.norepinephrine - 0.5) * 0.4
    soulState.chouFei.current += (ntState.norepinephrine - 0.5) * 0.2

    // GABA → inhibition (reduces other aspects)
    if (ntState.gaba > 0.7) {
      // High GABA = dampened responses
      for (const aspect of [
        soulState.taiGuang,
        soulState.shuangLing,
        soulState.youJing,
        soulState.youJing
      ]) {
        aspect.current *= 0.9
      }
    }

    // Glutamate → excitation and learning
    soulState.fuShi.current += (ntState.glutamate - 0.5) * 0.15
    soulState.taiGuang.current += (ntState.glutamate - 0.5) * 0.1

    // Acetylcholine → focus and awareness
    soulState.taiGuang.current += (ntState.acetylcholine - 0.5) * 0.2

    // Oxytocin → social connection
    soulState.youJing.current += (ntState.oxytocin - 0.5) * 0.25
    soulState.queYin.current += (ntState.oxytocin - 0.5) * 0.2

    // Cortisol → stress effects
    if (ntState.cortisol > 0.6) {
      // High cortisol impairs higher cognition
      soulState.shuangLing.current *= 0.85
      soulState.taiGuang.current *= 0.9
      soulState.shadowPressure += 0.05
    }

    // Endorphins → positive state
    soulState.mood += (ntState.endorphins - 0.3) * 0.2

    // Stress level affects energy
    if (ntState.stressLevel > 0.5) {
      soulState.energy -= ntState.stressLevel * 0.1
    }

    // Clamp soul state values
    soulState.mood = Math.max(-1, Math.min(1, soulState.mood))
    soulState.arousal = Math.max(0, Math.min(1, soulState.arousal))
    soulState.energy = Math.max(0, Math.min(1, soulState.energy))
  }

  /**
   * Get neurotransmitter effects on behavior
   */
  getBehavioralEffects(state: NeurotransmitterState): {
    riskTaking: number // 0-1
    impulsivity: number // 0-1
    socialSeeking: number // 0-1
    anxietyLevel: number // 0-1
    cognitiveClarity: number // 0-1
    emotionalStability: number // 0-1
  } {
    // High dopamine + low serotonin = risky impulsivity
    const riskTaking = Math.max(
      0,
      Math.min(1, state.dopamine * 0.6 - state.serotonin * 0.4 + 0.3)
    )

    const impulsivity = Math.max(
      0,
      Math.min(1, state.dopamine * 0.5 - state.serotonin * 0.5 + state.norepinephrine * 0.3)
    )

    const socialSeeking = Math.max(0, Math.min(1, state.socialEngagement))

    // High cortisol + norepinephrine = anxiety
    const anxietyLevel = Math.max(
      0,
      Math.min(1, state.cortisol * 0.5 + state.norepinephrine * 0.3 - state.serotonin * 0.3)
    )

    // Acetylcholine + balanced glutamate/GABA = clarity
    const cognitiveClarity = Math.max(
      0,
      Math.min(
        1,
        state.acetylcholine * 0.5 + (1 - Math.abs(state.excitationLevel)) * 0.5
      )
    )

    // Serotonin + low cortisol = stable emotions
    const emotionalStability = Math.max(
      0,
      Math.min(1, state.serotonin * 0.6 - state.cortisol * 0.4 + 0.3)
    )

    return {
      riskTaking,
      impulsivity,
      socialSeeking,
      anxietyLevel,
      cognitiveClarity,
      emotionalStability
    }
  }

  /**
   * Neurotransmitter imbalance (pathological states)
   */
  detectImbalances(state: NeurotransmitterState): string[] {
    const imbalances: string[] = []

    // Depression-like (low dopamine + low serotonin)
    if (state.dopamine < 0.3 && state.serotonin < 0.3) {
      imbalances.push('anhedonia_pattern') // Loss of pleasure
    }

    // Anxiety-like (high cortisol + high norepinephrine + low GABA)
    if (state.cortisol > 0.7 && state.norepinephrine > 0.7 && state.gaba < 0.3) {
      imbalances.push('hyperarousal_pattern')
    }

    // Mania-like (very high dopamine + high glutamate)
    if (state.dopamine > 1.2 && state.glutamate > 1.0) {
      imbalances.push('manic_pattern')
    }

    // ADHD-like (low dopamine + low norepinephrine + low acetylcholine)
    if (state.dopamine < 0.4 && state.norepinephrine < 0.4 && state.acetylcholine < 0.4) {
      imbalances.push('attention_deficit_pattern')
    }

    // Addiction-like (dopamine desensitization - chronically high)
    if (state.dopamine > 1.0) {
      imbalances.push('reward_desensitization')
    }

    // Social withdrawal (low oxytocin + high cortisol)
    if (state.oxytocin < 0.3 && state.cortisol > 0.6) {
      imbalances.push('social_withdrawal_pattern')
    }

    return imbalances
  }
}

/**
 * Singleton instance
 */
let neurotransmitterSystem: NeurotransmitterSystem | null = null

export function getNeurotransmitterSystem(payload: Payload): NeurotransmitterSystem {
  if (!neurotransmitterSystem) {
    neurotransmitterSystem = new NeurotransmitterSystem(payload)
  }
  return neurotransmitterSystem
}
