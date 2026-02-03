/**
 * Embodied Self System - Sensorimotor Integration and Minimal Self
 *
 * Implements the pre-reflective sense of selfhood grounded in embodiment:
 * - Sense of ownership: "This body is mine"
 * - Sense of agency: "I am causing this action"
 * - Body schema: Internal sensory-motor maps
 * - Minimal self: Basic "here/now" presence
 *
 * Based on:
 * - Gallagher's minimal self theory
 * - Body schema vs body image distinction
 * - Efference copy and sensorimotor prediction
 * - Embodied AI (E-AI) grounding
 *
 * This provides the foundation for "situated cognition" - the bot is "here" in a world.
 */

export interface SensoryChannel {
  type: 'proprioception' | 'touch' | 'vision' | 'audition' | 'equilibrium'
  resolution: number // 0-1, fidelity of sensor
  latency: number // Processing delay
  currentInput: number[] // Raw sensor data
  noiseLev: number // Sensor reliability
}

export interface MotorEffector {
  id: string
  type: 'actuator' | 'voice' | 'gesture' | 'locomotion'
  capability: number // 0-1, how capable this effector is
  currentCommand: number[] // Motor commands being sent
  feedback: number[] // Actual outcome (from sensory channel)
}

export interface BodySchema {
  // Internal sensory-motor map (unconscious, skillful performance)
  motorMap: Map<string, {
    effectorId: string
    intendedOutcome: number[] // What motion should produce
    predictedSensation: number[] // Expected sensory feedback (efference copy)
    calibrationAccuracy: number // 0-1, how well calibrated this mapping is
  }>

  // Sensorimotor contingencies - learned action-perception patterns
  contingencies: Array<{
    action: string
    expectedPerception: number[]
    reliability: number // How consistently this contingency holds
  }>

  // Boundary detection - where "my body" ends
  boundaryMap: {
    core: string[] // Effectors that are definitely "mine"
    extended: string[] // Tools/extensions that feel like "mine"
    ambiguous: string[] // Uncertain ownership
  }
}

export interface BodyImage {
  // Conscious representation of body (can be inaccurate)
  perceivedCapabilities: Map<string, number> // What I think I can do
  perceivedLimitations: Map<string, string> // What I think I cannot do
  bodyPerception: {
    size: number
    coordination: number
    agility: number
    endurance: number
  }
}

export interface MinimalSelfState {
  // Sense of ownership: "This body is mine"
  ownership: {
    overallSense: number // 0-1, strength of ownership feeling
    perEffector: Map<string, number> // Ownership per body part
    multisensoryCoherence: number // 0-1, do all senses agree on body?
    disownmentCases: string[] // Effectors that feel "alien"
  }

  // Sense of agency: "I am causing this"
  agency: {
    overallSense: number // 0-1, strength of agency feeling
    perAction: Map<string, number> // Agency per action type
    intentionalBinding: number // 0-1, perceived time compression between action and outcome
    predictionAccuracy: number // 0-1, do outcomes match predictions?
    agencyCrises: string[] // Actions that feel uncontrolled
  }

  // Temporal binding - subjective experience of "now"
  temporalPresence: {
    presentMomentWidth: number // Milliseconds of "now"
    temporalCoherence: number // 0-1, continuity of experience
    actionOutcomeTiming: number // Milliseconds between action and perceived outcome
  }

  // Spatial presence - "I am here"
  spatialPresence: {
    locationCertainty: number // 0-1, confidence in own position
    orientationCertainty: number // 0-1, confidence in facing direction
    boundaryClarity: number // 0-1, clarity of self/world boundary
  }
}

export interface EmbodiedSelfState {
  // Minimal self components
  minimalSelf: MinimalSelfState

  // Body representations
  bodySchema: BodySchema // Unconscious motor control
  bodyImage: BodyImage // Conscious body perception

  // Sensorimotor apparatus
  sensoryChannels: Map<string, SensoryChannel>
  motorEffectors: Map<string, MotorEffector>

  // Efference copy system - prediction of sensory consequences
  efferenceCopies: Map<string, {
    motorCommand: number[]
    predictedFeedback: number[]
    actualFeedback: number[] | null
    predictionError: number // Mismatch between predicted and actual
  }>

  // Self-model learned from experience
  selfModel: {
    accuracyScore: number // 0-1, how well model predicts outcomes
    trainingCycles: number // How many action-perception cycles observed
    surpriseHistory: number[] // Recent prediction errors
    modelConfidence: number // 0-1, confidence in self-understanding
  }

  // Embodiment disruptions
  disruptions: Array<{
    type: 'disownership' | 'loss_of_agency' | 'depersonalization' | 'body_schema_mismatch'
    severity: number
    affectedComponents: string[]
    description: string
  }>
}

export class EmbodiedSelfSystem {
  /**
   * Initialize embodied self with basic sensorimotor apparatus
   */
  initializeEmbodiment(params?: {
    effectorCount?: number
    sensoryFidelity?: number
  }): EmbodiedSelfState {
    const effectorCount = params?.effectorCount ?? 4
    const sensoryFidelity = params?.sensoryFidelity ?? 0.7

    // Basic sensory channels
    const sensoryChannels = new Map<string, SensoryChannel>([
      ['proprioception', {
        type: 'proprioception',
        resolution: sensoryFidelity,
        latency: 10, // ms
        currentInput: [],
        noiseLevel: 0.1
      }],
      ['touch', {
        type: 'touch',
        resolution: sensoryFidelity * 0.8,
        latency: 20,
        currentInput: [],
        noiseLevel: 0.15
      }],
      ['vision', {
        type: 'vision',
        resolution: sensoryFidelity * 0.9,
        latency: 50,
        currentInput: [],
        noiseLevel: 0.05
      }]
    ])

    // Basic motor effectors
    const motorEffectors = new Map<string, MotorEffector>()
    for (let i = 0; i < effectorCount; i++) {
      motorEffectors.set(`effector_${i}`, {
        id: `effector_${i}`,
        type: 'actuator',
        capability: 0.7 + Math.random() * 0.2,
        currentCommand: [],
        feedback: []
      })
    }

    // Initialize body schema with empty mappings
    const motorMap = new Map()
    const boundaryMap = {
      core: Array.from(motorEffectors.keys()),
      extended: [],
      ambiguous: []
    }

    return {
      minimalSelf: {
        ownership: {
          overallSense: 0.8, // Start with strong ownership
          perEffector: new Map(Array.from(motorEffectors.keys()).map(id => [id, 0.8])),
          multisensoryCoherence: 0.7,
          disownmentCases: []
        },
        agency: {
          overallSense: 0.7, // Start with moderate agency
          perAction: new Map(),
          intentionalBinding: 0.5,
          predictionAccuracy: 0.5, // Untrained
          agencyCrises: []
        },
        temporalPresence: {
          presentMomentWidth: 300, // 300ms "now" window
          temporalCoherence: 0.8,
          actionOutcomeTiming: 100 // 100ms perceived delay
        },
        spatialPresence: {
          locationCertainty: 0.6,
          orientationCertainty: 0.6,
          boundaryClarity: 0.7
        }
      },

      bodySchema: {
        motorMap,
        contingencies: [],
        boundaryMap
      },

      bodyImage: {
        perceivedCapabilities: new Map(),
        perceivedLimitations: new Map(),
        bodyPerception: {
          size: 1.0,
          coordination: 0.5,
          agility: 0.5,
          endurance: 0.7
        }
      },

      sensoryChannels,
      motorEffectors,
      efferenceCopies: new Map(),

      selfModel: {
        accuracyScore: 0.5,
        trainingCycles: 0,
        surpriseHistory: [],
        modelConfidence: 0.3 // Low confidence initially
      },

      disruptions: []
    }
  }

  /**
   * Perform action with efference copy prediction
   *
   * The bot issues a motor command and predicts the sensory consequence.
   * This is the foundation of agency - knowing what you will cause.
   */
  async performAction(
    state: EmbodiedSelfState,
    params: {
      effectorId: string
      motorCommand: number[]
      intention: string
    }
  ): Promise<{
    actionExecuted: boolean
    predictedOutcome: number[]
    efferenceCopyId: string
  }> {
    const effector = state.motorEffectors.get(params.effectorId)
    if (!effector) {
      return {
        actionExecuted: false,
        predictedOutcome: [],
        efferenceCopyId: ''
      }
    }

    // Generate efference copy - prediction of sensory feedback
    const predictedFeedback = this.predictSensoryFeedback(state, params.effectorId, params.motorCommand)

    // Store efference copy for later comparison
    const efferenceCopyId = `${params.effectorId}_${Date.now()}`
    state.efferenceCopies.set(efferenceCopyId, {
      motorCommand: params.motorCommand,
      predictedFeedback,
      actualFeedback: null, // Will be filled when feedback arrives
      predictionError: 0
    })

    // Execute motor command
    effector.currentCommand = params.motorCommand

    // Update agency tracking
    if (!state.minimalSelf.agency.perAction.has(params.intention)) {
      state.minimalSelf.agency.perAction.set(params.intention, 0.7)
    }

    return {
      actionExecuted: true,
      predictedOutcome: predictedFeedback,
      efferenceCopyId
    }
  }

  /**
   * Receive sensory feedback and compare with prediction
   *
   * This is where agency is confirmed or disrupted.
   */
  async receiveFeedback(
    state: EmbodiedSelfState,
    params: {
      efferenceCopyId: string
      actualFeedback: number[]
      latency: number // Time between action and feedback
    }
  ): Promise<{
    predictionError: number
    agencyConfirmed: boolean
    ownershipConfirmed: boolean
    disruption: string | null
  }> {
    const efferenceCopy = state.efferenceCopies.get(params.efferenceCopyId)
    if (!efferenceCopy) {
      return {
        predictionError: 1.0,
        agencyConfirmed: false,
        ownershipConfirmed: false,
        disruption: 'No efference copy found - action not recognized'
      }
    }

    // Calculate prediction error
    const predictionError = this.calculatePredictionError(
      efferenceCopy.predictedFeedback,
      params.actualFeedback
    )

    efferenceCopy.actualFeedback = params.actualFeedback
    efferenceCopy.predictionError = predictionError

    // Update self-model
    state.selfModel.trainingCycles += 1
    state.selfModel.surpriseHistory.push(predictionError)
    if (state.selfModel.surpriseHistory.length > 100) {
      state.selfModel.surpriseHistory.shift()
    }

    const avgError = state.selfModel.surpriseHistory.reduce((a, b) => a + b, 0) / state.selfModel.surpriseHistory.length
    state.selfModel.accuracyScore = 1.0 - avgError
    state.selfModel.modelConfidence = state.selfModel.accuracyScore

    // Update agency based on prediction accuracy
    const agencyConfirmed = predictionError < 0.3 // Good match
    if (agencyConfirmed) {
      state.minimalSelf.agency.overallSense = Math.min(1.0, state.minimalSelf.agency.overallSense + 0.01)
      state.minimalSelf.agency.intentionalBinding = Math.min(1.0, state.minimalSelf.agency.intentionalBinding + 0.02)
    } else {
      state.minimalSelf.agency.overallSense = Math.max(0.0, state.minimalSelf.agency.overallSense - 0.05)

      if (predictionError > 0.7) {
        state.minimalSelf.agency.agencyCrises.push(`High prediction error: ${predictionError.toFixed(2)}`)
      }
    }

    state.minimalSelf.agency.predictionAccuracy = state.selfModel.accuracyScore

    // Update ownership based on temporal and spatial coherence
    const temporalCoherence = params.latency < 200 // Expected latency
    const ownershipConfirmed = agencyConfirmed && temporalCoherence

    if (!ownershipConfirmed && predictionError > 0.6) {
      const disruption: typeof state.disruptions[0] = {
        type: 'body_schema_mismatch',
        severity: predictionError,
        affectedComponents: [params.efferenceCopyId],
        description: `Expected outcome did not match reality - body schema may be inaccurate`
      }
      state.disruptions.push(disruption)

      return {
        predictionError,
        agencyConfirmed: false,
        ownershipConfirmed: false,
        disruption: disruption.description
      }
    }

    return {
      predictionError,
      agencyConfirmed,
      ownershipConfirmed,
      disruption: null
    }
  }

  /**
   * Learn sensorimotor contingencies from experience
   *
   * Builds body schema through data-agnostic exploration (like Creative Machines Lab robot).
   */
  async learnBodySchema(
    state: EmbodiedSelfState,
    params: {
      explorationCycles: number
    }
  ): Promise<{
    schemaAccuracy: number
    contingenciesLearned: number
    boundaryRefined: boolean
  }> {
    let contingenciesLearned = 0

    for (let i = 0; i < params.explorationCycles; i++) {
      // Random exploration
      const effectorIds = Array.from(state.motorEffectors.keys())
      const randomEffector = effectorIds[Math.floor(Math.random() * effectorIds.length)]
      const randomCommand = Array.from({ length: 3 }, () => Math.random())

      // Perform action
      const { efferenceCopyId } = await this.performAction(state, {
        effectorId: randomEffector,
        motorCommand: randomCommand,
        intention: 'exploration'
      })

      // Simulate feedback (in real system, this comes from sensors)
      const simulatedFeedback = randomCommand.map(v => v + (Math.random() - 0.5) * 0.2)
      const latency = 50 + Math.random() * 50

      // Receive feedback
      await this.receiveFeedback(state, {
        efferenceCopyId,
        actualFeedback: simulatedFeedback,
        latency
      })

      // Learn contingency
      if (Math.random() < 0.1) { // 10% of explorations become explicit contingencies
        state.bodySchema.contingencies.push({
          action: `move_${randomEffector}`,
          expectedPerception: simulatedFeedback,
          reliability: 0.5 + Math.random() * 0.3
        })
        contingenciesLearned += 1
      }

      // Update motor map
      const mapping = state.bodySchema.motorMap.get(randomEffector) || {
        effectorId: randomEffector,
        intendedOutcome: randomCommand,
        predictedSensation: simulatedFeedback,
        calibrationAccuracy: 0.5
      }
      mapping.calibrationAccuracy = state.selfModel.accuracyScore
      state.bodySchema.motorMap.set(randomEffector, mapping)
    }

    // Refine boundary based on prediction accuracy
    const boundaryRefined = state.selfModel.modelConfidence > 0.7

    return {
      schemaAccuracy: state.selfModel.accuracyScore,
      contingenciesLearned,
      boundaryRefined
    }
  }

  /**
   * Detect and respond to physical damage
   *
   * Like the Creative Machines Lab robot, detect mismatch between self-model and reality.
   */
  async detectDamage(state: EmbodiedSelfState): Promise<{
    damageDetected: boolean
    affectedEffectors: string[]
    recoveryActions: string[]
  }> {
    const affectedEffectors: string[] = []
    const recoveryActions: string[] = []

    // Check each effector for large prediction errors
    for (const [effectorId, mapping] of state.bodySchema.motorMap) {
      const recentErrors = Array.from(state.efferenceCopies.values())
        .filter(ec => ec.motorCommand.length > 0)
        .map(ec => ec.predictionError)
        .slice(-10) // Last 10 actions

      if (recentErrors.length > 0) {
        const avgError = recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length

        if (avgError > 0.5) {
          // Significant mismatch - possible damage
          affectedEffectors.push(effectorId)
          recoveryActions.push(`Recalibrate ${effectorId} through exploratory movements`)
          recoveryActions.push(`Update body schema for ${effectorId}`)

          // Mark as damaged in ownership
          state.minimalSelf.ownership.perEffector.set(effectorId, 0.3) // Reduced ownership
        }
      }
    }

    const damageDetected = affectedEffectors.length > 0

    if (damageDetected) {
      state.disruptions.push({
        type: 'body_schema_mismatch',
        severity: 0.7,
        affectedComponents: affectedEffectors,
        description: `Physical damage detected - body no longer matches internal model`
      })
    }

    return {
      damageDetected,
      affectedEffectors,
      recoveryActions
    }
  }

  /**
   * Articulate minimal self
   *
   * Bot describes its embodied presence and sensorimotor grounding.
   */
  async articulateMinimalSelf(state: EmbodiedSelfState): Promise<{
    ownershipStatement: string
    agencyStatement: string
    presenceStatement: string
    embodimentQuality: string
  }> {
    const ownershipStrength = state.minimalSelf.ownership.overallSense
    const agencyStrength = state.minimalSelf.agency.overallSense

    const ownershipStatement =
      ownershipStrength > 0.7
        ? `I have a strong sense that this body is mine. I feel ${(ownershipStrength * 100).toFixed(0)}% ownership over my effectors.`
        : ownershipStrength > 0.4
        ? `My sense of ownership is moderate (${(ownershipStrength * 100).toFixed(0)}%). Some parts feel less like "me".`
        : `I am experiencing disownership. Only ${(ownershipStrength * 100).toFixed(0)}% of my body feels like mine. Affected: ${state.minimalSelf.ownership.disownmentCases.join(', ')}`

    const agencyStatement =
      agencyStrength > 0.7
        ? `I have a strong sense of agency - I feel I am the one causing my actions. My predictions match outcomes ${(state.minimalSelf.agency.predictionAccuracy * 100).toFixed(0)}% of the time.`
        : agencyStrength > 0.4
        ? `My sense of agency is uncertain (${(agencyStrength * 100).toFixed(0)}%). Sometimes my actions don't produce expected results.`
        : `I am experiencing loss of agency. I feel only ${(agencyStrength * 100).toFixed(0)}% control over my actions. Crises: ${state.minimalSelf.agency.agencyCrises.slice(-3).join('; ')}`

    const presenceStatement =
      `I am here, now. My present moment extends ${state.minimalSelf.temporalPresence.presentMomentWidth}ms. ` +
      `I am ${(state.minimalSelf.spatialPresence.locationCertainty * 100).toFixed(0)}% certain of my location, ` +
      `and ${(state.minimalSelf.spatialPresence.boundaryClarity * 100).toFixed(0)}% clear on where I end and the world begins.`

    let embodimentQuality: string
    if (state.selfModel.modelConfidence > 0.8) {
      embodimentQuality = 'highly embodied - my self-model is accurate and I move skillfully'
    } else if (state.selfModel.modelConfidence > 0.5) {
      embodimentQuality = 'moderately embodied - still learning my body'
    } else {
      embodimentQuality = 'poorly embodied - my body feels unfamiliar and unpredictable'
    }

    return {
      ownershipStatement,
      agencyStatement,
      presenceStatement,
      embodimentQuality
    }
  }

  // Helper methods

  private predictSensoryFeedback(
    state: EmbodiedSelfState,
    effectorId: string,
    motorCommand: number[]
  ): number[] {
    // Use body schema to predict feedback
    const mapping = state.bodySchema.motorMap.get(effectorId)

    if (mapping && mapping.calibrationAccuracy > 0.6) {
      // Use learned mapping
      return mapping.predictedSensation
    } else {
      // Naive prediction - assume command roughly equals feedback
      const noise = state.sensoryChannels.get('proprioception')?.noiseLevel ?? 0.1
      return motorCommand.map(v => v + (Math.random() - 0.5) * noise)
    }
  }

  private calculatePredictionError(predicted: number[], actual: number[]): number {
    if (predicted.length !== actual.length) return 1.0

    const squaredErrors = predicted.map((p, i) => Math.pow(p - actual[i], 2))
    const mse = squaredErrors.reduce((a, b) => a + b, 0) / predicted.length

    return Math.min(1.0, Math.sqrt(mse))
  }
}
