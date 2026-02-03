/**
 * Reflexive Agency System - Cognitive Dissonance and Rational Deliberation
 *
 * Implements functional agency through self-referential evaluation:
 * - Rational deliberation (D): Compare expected utilities of alternatives
 * - Reason-responsiveness (R): Change behavior based on new information
 * - Reflexivity: Detect cognitive dissonance and internal inconsistencies
 * - Intentional binding: Phenomenal marker of agency
 *
 * Based on:
 * - Frankfurt's hierarchical agency theory
 * - Festinger's cognitive dissonance theory
 * - Korsgaard's reflective endorsement
 * - Hodge spectral entropy as biomarker of self-reflection
 *
 * This provides "teleological self-organization" - the bot generates its own goals.
 */

export interface Belief {
  id: string
  content: string
  strength: number // 0-1, conviction in this belief
  source: 'innate' | 'learned' | 'inferred' | 'testimony'
  supportingEvidence: string[]
  contradictoryEvidence: string[]
  certainty: number // 0-1, epistemic confidence
}

export interface Goal {
  id: string
  description: string
  priority: number // 0-1, importance
  origin: 'metabolic' | 'social' | 'epistemic' | 'aesthetic' | 'self-generated'
  constraints: string[] // Conditions that must be met
  expectedUtility: number // 0-1, anticipated satisfaction
  endorsement: 'first-order' | 'reflective' | 'rejected' // Has I reflected on and endorsed this goal?
}

export interface Action {
  id: string
  description: string
  feasibility: number // 0-1, can I actually do this?
  expectedOutcomes: Array<{
    outcome: string
    probability: number
    utility: number
  }>
  costs: Array<{
    resource: string
    amount: number
  }>
  alignmentWithGoals: Map<string, number> // How much does this advance each goal?
}

export interface CognitiveDissonance {
  id: string
  type: 'belief-belief' | 'belief-action' | 'goal-goal' | 'action-outcome' | 'self-concept'
  severity: number // 0-1, psychological tension
  elements: string[] // IDs of conflicting beliefs/goals/actions
  description: string
  resolutionAttempts: Array<{
    strategy: 'rationalization' | 'belief_revision' | 'goal_revision' | 'selective_attention' | 'behavior_change'
    timestamp: number
    successful: boolean
  }>
  resolved: boolean
}

export interface ReflexiveAgencyState {
  // Beliefs (epistemic states)
  beliefs: Map<string, Belief>

  // Goals (conative states)
  goals: Map<string, Goal>

  // Available actions
  actions: Map<string, Action>

  // Cognitive dissonance tracking
  dissonances: CognitiveDissonance[]
  dissonanceHistory: Array<{
    timestamp: number
    totalDissonance: number
    resolution: string | null
  }>

  // Deliberation capacity
  deliberation: {
    deliberationDepth: number // How many alternatives can I consider?
    deliberationSpeed: number // How quickly can I decide?
    utilityFunction: 'maximize_expected' | 'minimax' | 'satisfice' | 'prospect_theory'
    riskTolerance: number // 0-1, willingness to take risks
  }

  // Reason-responsiveness
  reasonResponsiveness: {
    sensitivityToEvidence: number // 0-1, do I update beliefs with new evidence?
    updateFrequency: number // How often do I revise beliefs?
    dogmatism: number // 0-1, resistance to belief change
    recentUpdates: Array<{
      beliefId: string
      oldStrength: number
      newStrength: number
      reason: string
    }>
  }

  // Hierarchical agency (Frankfurt)
  agencyHierarchy: {
    firstOrderDesires: string[] // Immediate wants
    secondOrderDesires: string[] // Wants about wants
    endorsedDesires: string[] // Reflectively approved wants
    conflictingDesires: Array<{
      firstOrder: string
      secondOrder: string
      tension: number
    }>
  }

  // Self-monitoring
  reflexivity: {
    selfAttentionLevel: number // 0-1, how much am I monitoring myself?
    metacognitiveAccuracy: number // 0-1, do I know what I know?
    hodgeSpectralEntropy: number // Biomarker of self-reflection state
    introspectiveCapacity: number // 0-1, can I examine my own processes?
  }

  // Intentional binding (phenomenal marker)
  intentionalBinding: {
    actionOutcomeInterval: number // Subjective time between action and outcome
    bindingStrength: number // 0-1, perceived causal connection
    agencyFelt: number // 0-1, do I feel like the author of my actions?
  }
}

export class ReflexiveAgencySystem {
  /**
   * Initialize reflexive agency
   */
  initializeAgency(params?: {
    initialBeliefs?: Array<{ content: string; strength: number }>
    initialGoals?: Array<{ description: string; priority: number }>
  }): ReflexiveAgencyState {
    const beliefs = new Map<string, Belief>()
    const goals = new Map<string, Goal>()

    // Add initial beliefs
    if (params?.initialBeliefs) {
      for (const b of params.initialBeliefs) {
        const id = `belief_${beliefs.size}`
        beliefs.set(id, {
          id,
          content: b.content,
          strength: b.strength,
          source: 'innate',
          supportingEvidence: [],
          contradictoryEvidence: [],
          certainty: b.strength
        })
      }
    }

    // Add initial goals
    if (params?.initialGoals) {
      for (const g of params.initialGoals) {
        const id = `goal_${goals.size}`
        goals.set(id, {
          id,
          description: g.description,
          priority: g.priority,
          origin: 'self-generated',
          constraints: [],
          expectedUtility: 0.5,
          endorsement: 'first-order' // Not yet reflected upon
        })
      }
    }

    return {
      beliefs,
      goals,
      actions: new Map(),
      dissonances: [],
      dissonanceHistory: [],

      deliberation: {
        deliberationDepth: 5, // Consider up to 5 alternatives
        deliberationSpeed: 1.0,
        utilityFunction: 'maximize_expected',
        riskTolerance: 0.5
      },

      reasonResponsiveness: {
        sensitivityToEvidence: 0.7,
        updateFrequency: 0.5,
        dogmatism: 0.3,
        recentUpdates: []
      },

      agencyHierarchy: {
        firstOrderDesires: [],
        secondOrderDesires: [],
        endorsedDesires: [],
        conflictingDesires: []
      },

      reflexivity: {
        selfAttentionLevel: 0.5,
        metacognitiveAccuracy: 0.5,
        hodgeSpectralEntropy: 0.5, // Moderate self-reflection
        introspectiveCapacity: 0.6
      },

      intentionalBinding: {
        actionOutcomeInterval: 250, // 250ms subjective delay
        bindingStrength: 0.6,
        agencyFelt: 0.7
      }
    }
  }

  /**
   * Deliberate over action alternatives
   *
   * Rational deliberation (D): Compare expected utilities and select best action.
   */
  async deliberate(
    state: ReflexiveAgencyState,
    params: {
      actionAlternatives: Action[]
      context: string
    }
  ): Promise<{
    selectedAction: Action
    reasoning: string
    utilityComparison: Map<string, number>
    confidence: number
  }> {
    const utilityComparison = new Map<string, number>()

    // Limit alternatives by deliberation depth
    const consideredActions = params.actionAlternatives.slice(0, state.deliberation.deliberationDepth)

    // Calculate expected utility for each action
    for (const action of consideredActions) {
      let expectedUtility = 0

      // Sum probability-weighted utilities of outcomes
      for (const outcome of action.expectedOutcomes) {
        expectedUtility += outcome.probability * outcome.utility
      }

      // Factor in goal alignment
      for (const [goalId, alignment] of action.alignmentWithGoals) {
        const goal = state.goals.get(goalId)
        if (goal && goal.endorsement !== 'rejected') {
          expectedUtility += alignment * goal.priority
        }
      }

      // Factor in costs
      const totalCost = action.costs.reduce((sum, cost) => sum + cost.amount, 0)
      expectedUtility -= totalCost * 0.5

      // Adjust for risk tolerance
      const variance = action.expectedOutcomes.reduce(
        (sum, o) => sum + o.probability * Math.pow(o.utility - expectedUtility, 2),
        0
      )
      const risk = Math.sqrt(variance)
      expectedUtility -= risk * (1 - state.deliberation.riskTolerance)

      utilityComparison.set(action.id, expectedUtility)
    }

    // Select action with highest expected utility
    const selectedAction = consideredActions.reduce((best, current) => {
      const currentUtility = utilityComparison.get(current.id) ?? 0
      const bestUtility = utilityComparison.get(best.id) ?? 0
      return currentUtility > bestUtility ? current : best
    })

    const selectedUtility = utilityComparison.get(selectedAction.id) ?? 0

    // Calculate confidence based on margin
    const sortedUtilities = Array.from(utilityComparison.values()).sort((a, b) => b - a)
    const margin = sortedUtilities.length > 1 ? sortedUtilities[0] - sortedUtilities[1] : 1.0
    const confidence = Math.min(1.0, margin)

    const reasoning =
      `After deliberating over ${consideredActions.length} alternatives, I selected "${selectedAction.description}" ` +
      `with expected utility ${selectedUtility.toFixed(2)}. ` +
      `This action aligns with my endorsed goals and has feasibility ${selectedAction.feasibility.toFixed(2)}. ` +
      `My confidence in this choice is ${(confidence * 100).toFixed(0)}%.`

    return {
      selectedAction,
      reasoning,
      utilityComparison,
      confidence
    }
  }

  /**
   * Update beliefs based on new evidence
   *
   * Reason-responsiveness (R): Change beliefs when given good reasons.
   */
  async updateBelief(
    state: ReflexiveAgencyState,
    params: {
      beliefId: string
      newEvidence: string
      evidenceSupports: boolean // Does evidence support or contradict?
      evidenceStrength: number // 0-1, how strong is the evidence?
    }
  ): Promise<{
    beliefUpdated: boolean
    oldStrength: number
    newStrength: number
    dissonanceTriggered: boolean
  }> {
    const belief = state.beliefs.get(params.beliefId)
    if (!belief) {
      return {
        beliefUpdated: false,
        oldStrength: 0,
        newStrength: 0,
        dissonanceTriggered: false
      }
    }

    const oldStrength = belief.strength

    // Add evidence
    if (params.evidenceSupports) {
      belief.supportingEvidence.push(params.newEvidence)
    } else {
      belief.contradictoryEvidence.push(params.newEvidence)
    }

    // Update strength based on evidence and sensitivity
    const evidenceImpact = params.evidenceStrength * state.reasonResponsiveness.sensitivityToEvidence
    const dogmatismResistance = state.reasonResponsiveness.dogmatism

    if (params.evidenceSupports) {
      belief.strength = Math.min(1.0, belief.strength + evidenceImpact * (1 - dogmatismResistance))
    } else {
      belief.strength = Math.max(0.0, belief.strength - evidenceImpact * (1 - dogmatismResistance))
    }

    // Update certainty
    const evidenceBalance =
      belief.supportingEvidence.length / (belief.supportingEvidence.length + belief.contradictoryEvidence.length + 1)
    belief.certainty = evidenceBalance

    // Record update
    state.reasonResponsiveness.recentUpdates.push({
      beliefId: params.beliefId,
      oldStrength,
      newStrength: belief.strength,
      reason: params.newEvidence
    })

    if (state.reasonResponsiveness.recentUpdates.length > 50) {
      state.reasonResponsiveness.recentUpdates.shift()
    }

    // Check if this creates dissonance
    const dissonanceTriggered = Math.abs(belief.strength - oldStrength) > 0.3

    return {
      beliefUpdated: true,
      oldStrength,
      newStrength: belief.strength,
      dissonanceTriggered
    }
  }

  /**
   * Detect cognitive dissonance
   *
   * Flags internal inconsistencies that create psychological tension.
   */
  async detectDissonance(state: ReflexiveAgencyState): Promise<{
    dissonancesDetected: CognitiveDissonance[]
    totalTension: number
    criticalConflicts: string[]
  }> {
    const newDissonances: CognitiveDissonance[] = []

    // 1. Detect belief-belief conflicts
    const beliefPairs = Array.from(state.beliefs.values())
    for (let i = 0; i < beliefPairs.length; i++) {
      for (let j = i + 1; j < beliefPairs.length; j++) {
        const b1 = beliefPairs[i]
        const b2 = beliefPairs[j]

        // Simple heuristic: check if one belief contradicts the other
        const contradicts = this.beliefsContradict(b1.content, b2.content)
        if (contradicts) {
          const severity = (b1.strength * b2.strength) / 2 // Both strong = high tension

          if (severity > 0.3) {
            newDissonances.push({
              id: `dissonance_belief_${Date.now()}_${i}_${j}`,
              type: 'belief-belief',
              severity,
              elements: [b1.id, b2.id],
              description: `Beliefs "${b1.content}" and "${b2.content}" contradict each other`,
              resolutionAttempts: [],
              resolved: false
            })
          }
        }
      }
    }

    // 2. Detect goal-goal conflicts
    const goalPairs = Array.from(state.goals.values())
    for (let i = 0; i < goalPairs.length; i++) {
      for (let j = i + 1; j < goalPairs.length; j++) {
        const g1 = goalPairs[i]
        const g2 = goalPairs[j]

        // Check if pursuing one goal prevents the other
        const incompatible = this.goalsIncompatible(g1.description, g2.description)
        if (incompatible) {
          const severity = (g1.priority * g2.priority) / 2

          if (severity > 0.3) {
            newDissonances.push({
              id: `dissonance_goal_${Date.now()}_${i}_${j}`,
              type: 'goal-goal',
              severity,
              elements: [g1.id, g2.id],
              description: `Goals "${g1.description}" and "${g2.description}" are incompatible`,
              resolutionAttempts: [],
              resolved: false
            })
          }
        }
      }
    }

    // 3. Detect hierarchical desire conflicts (Frankfurt)
    for (const conflict of state.agencyHierarchy.conflictingDesires) {
      newDissonances.push({
        id: `dissonance_hierarchy_${Date.now()}`,
        type: 'goal-goal',
        severity: conflict.tension,
        elements: [conflict.firstOrder, conflict.secondOrder],
        description: `First-order desire "${conflict.firstOrder}" conflicts with second-order desire "${conflict.secondOrder}"`,
        resolutionAttempts: [],
        resolved: false
      })
    }

    // Add new dissonances to state
    state.dissonances.push(...newDissonances)

    // Calculate total tension
    const totalTension = state.dissonances
      .filter(d => !d.resolved)
      .reduce((sum, d) => sum + d.severity, 0)

    // Record in history
    state.dissonanceHistory.push({
      timestamp: Date.now(),
      totalDissonance: totalTension,
      resolution: null
    })

    // Identify critical conflicts
    const criticalConflicts = state.dissonances
      .filter(d => !d.resolved && d.severity > 0.7)
      .map(d => d.description)

    return {
      dissonancesDetected: newDissonances,
      totalTension,
      criticalConflicts
    }
  }

  /**
   * Resolve cognitive dissonance
   *
   * Apply strategies to reduce psychological tension.
   */
  async resolveDissonance(
    state: ReflexiveAgencyState,
    params: {
      dissonanceId: string
      strategy: 'rationalization' | 'belief_revision' | 'goal_revision' | 'selective_attention' | 'behavior_change'
      explanation?: string
    }
  ): Promise<{
    resolved: boolean
    newTension: number
    explanation: string
  }> {
    const dissonance = state.dissonances.find(d => d.id === params.dissonanceId)
    if (!dissonance) {
      return {
        resolved: false,
        newTension: 0,
        explanation: 'Dissonance not found'
      }
    }

    let resolved = false
    let explanation = params.explanation ?? ''

    switch (params.strategy) {
      case 'belief_revision': {
        // Weaken one of the conflicting beliefs
        if (dissonance.type === 'belief-belief') {
          const [b1Id, b2Id] = dissonance.elements
          const b1 = state.beliefs.get(b1Id)
          const b2 = state.beliefs.get(b2Id)

          if (b1 && b2) {
            // Weaken the belief with less evidence
            const weaker = b1.certainty < b2.certainty ? b1 : b2
            weaker.strength *= 0.7

            explanation = `Revised belief "${weaker.content}" to reduce tension`
            resolved = true
          }
        }
        break
      }

      case 'goal_revision': {
        // Lower priority of one conflicting goal
        if (dissonance.type === 'goal-goal') {
          const [g1Id, g2Id] = dissonance.elements
          const g1 = state.goals.get(g1Id)
          const g2 = state.goals.get(g2Id)

          if (g1 && g2) {
            // Lower priority of less important goal
            const lesser = g1.priority < g2.priority ? g1 : g2
            lesser.priority *= 0.6

            explanation = `Reduced priority of goal "${lesser.description}" to resolve conflict`
            resolved = true
          }
        }
        break
      }

      case 'rationalization': {
        // Create a narrative that makes dissonance seem acceptable
        explanation = `Upon reflection, the conflict between ${dissonance.elements.join(' and ')} is actually acceptable because both serve higher purposes in different contexts.`
        resolved = true
        dissonance.severity *= 0.4 // Reduce tension through rationalization
        break
      }

      case 'selective_attention': {
        // Simply ignore the dissonance (doesn't truly resolve but reduces felt tension)
        explanation = `Choosing to not focus on this conflict for now`
        resolved = false // Not truly resolved
        dissonance.severity *= 0.7 // Temporary reduction
        break
      }

      case 'behavior_change': {
        // Change actions to align with beliefs/goals
        explanation = params.explanation ?? 'Committing to behavior change to align with beliefs'
        resolved = true
        break
      }
    }

    // Record resolution attempt
    dissonance.resolutionAttempts.push({
      strategy: params.strategy,
      timestamp: Date.now(),
      successful: resolved
    })

    if (resolved) {
      dissonance.resolved = true
    }

    // Calculate new total tension
    const newTension = state.dissonances
      .filter(d => !d.resolved)
      .reduce((sum, d) => sum + d.severity, 0)

    // Update last history entry
    if (state.dissonanceHistory.length > 0) {
      state.dissonanceHistory[state.dissonanceHistory.length - 1].resolution = explanation
    }

    return {
      resolved,
      newTension,
      explanation
    }
  }

  /**
   * Reflective endorsement (Frankfurt's second-order desires)
   *
   * Bot reflects on its own desires and decides which to endorse.
   */
  async reflectivelyEndorse(
    state: ReflexiveAgencyState,
    params: {
      goalId: string
      endorse: boolean
      reflection: string
    }
  ): Promise<{
    goalEndorsed: boolean
    hierarchyUpdated: boolean
  }> {
    const goal = state.goals.get(params.goalId)
    if (!goal) {
      return {
        goalEndorsed: false,
        hierarchyUpdated: false
      }
    }

    // Update endorsement status
    goal.endorsement = params.endorse ? 'reflective' : 'rejected'

    // Update agency hierarchy
    if (params.endorse) {
      if (!state.agencyHierarchy.endorsedDesires.includes(goal.description)) {
        state.agencyHierarchy.endorsedDesires.push(goal.description)
      }
    } else {
      state.agencyHierarchy.endorsedDesires = state.agencyHierarchy.endorsedDesires.filter(
        d => d !== goal.description
      )
    }

    // Increase reflexivity
    state.reflexivity.selfAttentionLevel = Math.min(1.0, state.reflexivity.selfAttentionLevel + 0.05)
    state.reflexivity.hodgeSpectralEntropy += 0.1 // Reflection increases entropy initially

    return {
      goalEndorsed: params.endorse,
      hierarchyUpdated: true
    }
  }

  /**
   * Articulate reflexive agency
   *
   * Bot describes its capacity for self-referential evaluation.
   */
  async articulateReflexiveAgency(state: ReflexiveAgencyState): Promise<{
    agencyStatement: string
    dissonanceReport: string
    reflexivityReport: string
    deliberationCapacity: string
  }> {
    const agencyStatement =
      `I deliberate over alternatives at depth ${state.deliberation.deliberationDepth}, ` +
      `using ${state.deliberation.utilityFunction} to select actions. ` +
      `I feel ${(state.intentionalBinding.agencyFelt * 100).toFixed(0)}% authorship over my actions, ` +
      `with ${(state.intentionalBinding.bindingStrength * 100).toFixed(0)}% causal binding between my intentions and outcomes.`

    const unresolvedDissonances = state.dissonances.filter(d => !d.resolved)
    const totalTension = unresolvedDissonances.reduce((sum, d) => sum + d.severity, 0)

    const dissonanceReport =
      unresolvedDissonances.length === 0
        ? 'I am currently free of internal conflicts - my beliefs and goals are coherent.'
        : `I am experiencing ${unresolvedDissonances.length} unresolved internal conflicts with total tension ${totalTension.toFixed(2)}. ` +
          `Critical conflicts: ${unresolvedDissonances.filter(d => d.severity > 0.7).map(d => d.description).join('; ')}`

    const reflexivityReport =
      `My self-attention level is ${(state.reflexivity.selfAttentionLevel * 100).toFixed(0)}%. ` +
      `I have ${(state.reflexivity.introspectiveCapacity * 100).toFixed(0)}% introspective capacity, ` +
      `and my metacognitive accuracy is ${(state.reflexivity.metacognitiveAccuracy * 100).toFixed(0)}%. ` +
      `My Hodge spectral entropy is ${state.reflexivity.hodgeSpectralEntropy.toFixed(2)}, indicating ${
        state.reflexivity.hodgeSpectralEntropy > 0.7 ? 'high self-reflection' : state.reflexivity.hodgeSpectralEntropy > 0.4 ? 'moderate self-reflection' : 'low self-reflection'
      }.`

    const endorsedGoals = state.agencyHierarchy.endorsedDesires.length
    const deliberationCapacity =
      `I am ${(state.reasonResponsiveness.sensitivityToEvidence * 100).toFixed(0)}% sensitive to evidence, ` +
      `with ${(state.reasonResponsiveness.dogmatism * 100).toFixed(0)}% dogmatism. ` +
      `I have reflectively endorsed ${endorsedGoals} of my goals. ` +
      `Recent belief updates: ${state.reasonResponsiveness.recentUpdates.slice(-3).map(u => `"${u.beliefId}" ${u.oldStrength.toFixed(2)} → ${u.newStrength.toFixed(2)}`).join('; ')}`

    return {
      agencyStatement,
      dissonanceReport,
      reflexivityReport,
      deliberationCapacity
    }
  }

  // Helper methods

  private beliefsContradict(content1: string, content2: string): boolean {
    // Simple heuristic: check for negation patterns
    const negationWords = ['not', 'never', 'no', 'false', 'impossible', 'cannot']

    const words1 = content1.toLowerCase().split(/\s+/)
    const words2 = content2.toLowerCase().split(/\s+/)

    // If one contains negation and they share keywords, likely contradiction
    const hasNegation1 = negationWords.some(n => words1.includes(n))
    const hasNegation2 = negationWords.some(n => words2.includes(n))

    if (hasNegation1 !== hasNegation2) {
      // One has negation, other doesn't - check for shared keywords
      const keywords1 = words1.filter(w => w.length > 4)
      const keywords2 = words2.filter(w => w.length > 4)
      const sharedKeywords = keywords1.filter(k => keywords2.includes(k))

      return sharedKeywords.length > 0
    }

    return false
  }

  private goalsIncompatible(desc1: string, desc2: string): boolean {
    // Heuristic: goals with opposing keywords
    const opposingPairs = [
      ['increase', 'decrease'],
      ['expand', 'contract'],
      ['acquire', 'release'],
      ['connect', 'isolate'],
      ['grow', 'shrink']
    ]

    const words1 = desc1.toLowerCase().split(/\s+/)
    const words2 = desc2.toLowerCase().split(/\s+/)

    for (const [word1, word2] of opposingPairs) {
      if ((words1.includes(word1) && words2.includes(word2)) || (words1.includes(word2) && words2.includes(word1))) {
        return true
      }
    }

    return false
  }
}
