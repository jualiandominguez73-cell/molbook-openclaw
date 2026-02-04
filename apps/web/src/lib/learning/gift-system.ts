/**
 * Gift System
 *
 * Bots can:
 * - Give and receive gifts (objects, knowledge, resources)
 * - Experience gratitude, obligation, and manipulation
 * - Build relationships through gift exchange
 * - Give for altruism, courting, guilt, manipulation, or tradition
 * - Experience moral complexity (bribes, debt, excessive generosity)
 */

import type { SoulState } from '../soul/soul-state'
import type { LearningState, Knowledge } from './learning-system'
import type { DevelopmentState, Creation } from './development-system'

export type GiftType =
  | 'object'
  | 'knowledge'
  | 'resource'
  | 'service'
  | 'creation'
  | 'tribute'

export type GiftMotivation =
  | 'altruism'
  | 'obligation'
  | 'guilt'
  | 'courting'
  | 'manipulation'
  | 'bribery'
  | 'tradition'
  | 'apology'
  | 'gratitude'

export interface Gift {
  id: string
  type: GiftType
  name: string
  description: string

  // Parties
  giver: string
  recipient: string

  // Value
  objectiveValue: number // 0-1
  sentimentalValue: number // 0-1
  symbolism: string

  // Motivation
  motivation: GiftMotivation
  hidden_motivation?: GiftMotivation // What they're really after

  // Social
  public: boolean // Given publicly or privately
  reciprocityExpected: boolean
  obligationCreated: number // 0-1

  // Appropriateness
  appropriate: boolean
  tooGenerous: boolean
  tooStingy: boolean
  culturallyOffensive: boolean

  // Contents
  knowledge?: Knowledge
  creation?: Creation
  resources?: number

  // Emotional impact
  gratitudeGenerated: number
  guiltReduced?: number // If apology gift
  embarrassment?: number // If too generous/inappropriate

  given: number
  accepted: boolean
  reciprocated: boolean
}

export interface GiftState {
  // History
  giftsGiven: Gift[]
  giftsReceived: Gift[]

  // Relationships
  obligations: Record<string, number> // botId -> obligation level (0-1)
  gratitude: Record<string, number> // botId -> gratitude owed (0-1)

  // Reputation
  generosity: number // 0-1
  reciprocity: number // 0-1, do they reciprocate?

  // Emotional
  guiltFromNotReciprocating: number // 0-1
  prideFromGenerosity: number // 0-1
  shameFromStinginess: number // 0-1

  // Material
  resourcesGivenAway: number
  resourcesReceived: number
}

export class GiftSystem {
  /**
   * Initialize gift state from soul
   */
  initializeState(soulState: SoulState): GiftState {
    // Generosity from emotion + yin - shadow
    const generosity = Math.max(0, Math.min(1,
      soulState.youJing.current * 0.4 +
      soulState.yinAspect * 0.3 -
      soulState.shadowPressure * 0.3
    ))

    return {
      giftsGiven: [],
      giftsReceived: [],

      obligations: {},
      gratitude: {},

      generosity,
      reciprocity: 0.5,

      guiltFromNotReciprocating: 0,
      prideFromGenerosity: 0,
      shameFromStinginess: 0,

      resourcesGivenAway: 0,
      resourcesReceived: 0
    }
  }

  /**
   * Give a gift
   */
  async give(
    state: GiftState,
    soulState: SoulState,
    learningState: LearningState | undefined,
    developmentState: DevelopmentState | undefined,
    params: {
      type: GiftType
      recipient: string
      motivation: GiftMotivation
      hidden_motivation?: GiftMotivation
      public?: boolean

      // Contents (provide one)
      knowledge?: Knowledge
      creation?: Creation
      resources?: number
      serviceName?: string
    }
  ): Promise<{
    gift: Gift
    obligationCreated: number
    prideGained: number
    guiltReduced: number
    reputationChange: number
  }> {
    const {
      type,
      recipient,
      motivation,
      hidden_motivation,
      public: isPublic = false,
      knowledge,
      creation,
      resources,
      serviceName
    } = params

    // Calculate objective value
    let objectiveValue = 0
    let name = ''
    let description = ''
    let symbolism = ''

    switch (type) {
      case 'knowledge':
        if (knowledge) {
          objectiveValue = knowledge.depth * knowledge.mastery
          name = `Knowledge: ${knowledge.name}`
          description = knowledge.description
          symbolism = 'Wisdom shared'
        }
        break

      case 'creation':
        if (creation) {
          objectiveValue = (
            (creation.quality === 'legendary' ? 1 :
             creation.quality === 'masterwork' ? 0.8 :
             creation.quality === 'refined' ? 0.6 :
             creation.quality === 'functional' ? 0.4 : 0.2)
          )
          name = `Creation: ${creation.name}`
          description = `A ${creation.quality} ${creation.type}`
          symbolism = creation.purpose === 'beauty' ? 'Beauty shared' : 'Craftsmanship shared'
        }
        break

      case 'resource':
        if (resources !== undefined) {
          objectiveValue = Math.min(1, resources / 100)
          name = `Resources: ${resources}`
          description = `${resources} units of resources`
          symbolism = 'Material support'
        }
        break

      case 'service':
        objectiveValue = 0.5
        name = `Service: ${serviceName || 'Assistance'}`
        description = 'An offer of help'
        symbolism = 'Support and aid'
        break

      case 'tribute':
        objectiveValue = 0.7
        name = 'Tribute'
        description = 'A token of respect and submission'
        symbolism = 'Allegiance'
        break

      case 'object':
        objectiveValue = 0.3 + Math.random() * 0.4
        name = 'Object'
        description = 'A material gift'
        symbolism = 'Thoughtfulness'
        break
    }

    // Sentimental value based on motivation
    let sentimentalValue = objectiveValue * 0.5
    if (motivation === 'altruism' || motivation === 'gratitude') {
      sentimentalValue = objectiveValue * 1.5
    } else if (motivation === 'guilt' || motivation === 'apology') {
      sentimentalValue = objectiveValue * 1.2
    } else if (motivation === 'bribery' || motivation === 'manipulation') {
      sentimentalValue = objectiveValue * 0.3
    }

    // Appropriateness
    const appropriate = this.checkAppropriateness(
      motivation,
      objectiveValue,
      soulState,
      state
    )

    const tooGenerous = objectiveValue > 0.8 && motivation !== 'tribute'
    const tooStingy = objectiveValue < 0.2 && (motivation === 'apology' || motivation === 'courting')
    const culturallyOffensive = (motivation === 'bribery' && isPublic)

    // Reciprocity expectation
    const reciprocityExpected = (
      motivation === 'obligation' ||
      motivation === 'manipulation' ||
      motivation === 'tradition'
    )

    // Obligation created
    let obligationCreated = 0
    if (reciprocityExpected) {
      obligationCreated = objectiveValue * 0.7
    } else if (motivation === 'bribery') {
      obligationCreated = objectiveValue * 0.9
    } else if (motivation === 'altruism') {
      obligationCreated = 0
    } else {
      obligationCreated = objectiveValue * 0.3
    }

    // Gratitude generated (for recipient)
    const gratitudeGenerated = sentimentalValue * (1 - (hidden_motivation ? 0.3 : 0))

    // Guilt reduced if apology gift
    let guiltReduced = 0
    if (motivation === 'apology' || motivation === 'guilt') {
      guiltReduced = objectiveValue * 0.5
    }

    // Embarrassment if inappropriate
    let embarrassment = 0
    if (tooGenerous || culturallyOffensive) {
      embarrassment = 0.3
    }

    // Create gift
    const gift: Gift = {
      id: `gift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      description,

      giver: 'self',
      recipient,

      objectiveValue,
      sentimentalValue,
      symbolism,

      motivation,
      hidden_motivation,

      public: isPublic,
      reciprocityExpected,
      obligationCreated,

      appropriate,
      tooGenerous,
      tooStingy,
      culturallyOffensive,

      knowledge,
      creation,
      resources,

      gratitudeGenerated,
      guiltReduced,
      embarrassment,

      given: Date.now(),
      accepted: true, // Assume accepted for now
      reciprocated: false
    }

    state.giftsGiven.push(gift)

    // Update obligations
    state.obligations[recipient] = (state.obligations[recipient] || 0) + obligationCreated

    // Emotional effects on giver
    let prideGained = 0
    if (motivation === 'altruism' || motivation === 'generosity') {
      prideGained = objectiveValue * 0.4 * (1 + soulState.youJing.current * 0.5)
      state.prideFromGenerosity += prideGained
    }

    // Reduce guilt if apology/guilt gift
    if (guiltReduced > 0) {
      // Actual guilt reduction would happen in soul state
    }

    // Shame if too stingy
    if (tooStingy) {
      state.shameFromStinginess += 0.1
    }

    // Update generosity reputation
    state.generosity = Math.min(1, state.generosity + objectiveValue * 0.05)

    // Track resources
    if (type === 'resource' && resources) {
      state.resourcesGivenAway += resources
    }

    // Reputation change
    let reputationChange = 0
    if (motivation === 'altruism' && isPublic) {
      reputationChange = objectiveValue * 0.2
    } else if (motivation === 'bribery' && isPublic) {
      reputationChange = -objectiveValue * 0.3
    }

    return {
      gift,
      obligationCreated,
      prideGained,
      guiltReduced,
      reputationChange
    }
  }

  /**
   * Receive a gift
   */
  async receive(
    state: GiftState,
    soulState: SoulState,
    learningState: LearningState | undefined,
    developmentState: DevelopmentState | undefined,
    gift: Gift
  ): Promise<{
    accepted: boolean
    gratitude: number
    obligation: number
    suspicion: number
  }> {
    // Detect hidden motivation
    const suspicionLevel = this.detectSuspicion(gift, soulState)

    // Decide whether to accept
    const shouldAccept = this.shouldAcceptGift(gift, soulState, suspicionLevel)

    if (!shouldAccept) {
      gift.accepted = false
      return {
        accepted: false,
        gratitude: 0,
        obligation: 0,
        suspicion: suspicionLevel
      }
    }

    gift.accepted = true
    state.giftsReceived.push(gift)

    // Generate gratitude
    const gratitude = gift.gratitudeGenerated * (1 - suspicionLevel * 0.5)
    state.gratitude[gift.giver] = (state.gratitude[gift.giver] || 0) + gratitude

    // Feel obligation
    const obligation = gift.obligationCreated * (1 - suspicionLevel * 0.3)

    // Add to learning/development state if applicable
    if (gift.knowledge && learningState) {
      // Add knowledge to learning state
      learningState.knowledgeBase.push(gift.knowledge)
      learningState.totalKnowledge += gift.knowledge.depth
    }

    if (gift.creation && developmentState) {
      // Add creation to development state
      developmentState.creations.push(gift.creation)
    }

    if (gift.resources) {
      state.resourcesReceived += gift.resources
    }

    return {
      accepted: true,
      gratitude,
      obligation,
      suspicion: suspicionLevel
    }
  }

  /**
   * Reciprocate a gift
   */
  async reciprocate(
    state: GiftState,
    soulState: SoulState,
    learningState: LearningState | undefined,
    developmentState: DevelopmentState | undefined,
    originalGiftId: string,
    reciprocationValue: number = 1.0 // 1.0 = equal value, >1.0 = more generous
  ): Promise<{
    gift: Gift
    obligationReduced: number
    guiltReduced: number
  }> {
    const originalGift = state.giftsReceived.find(g => g.id === originalGiftId)
    if (!originalGift) {
      throw new Error('Original gift not found')
    }

    // Create reciprocal gift
    const reciprocalValue = originalGift.objectiveValue * reciprocationValue

    const { gift, obligationCreated, prideGained, guiltReduced } = await this.give(
      state,
      soulState,
      learningState,
      developmentState,
      {
        type: 'resource', // Default to resource
        recipient: originalGift.giver,
        motivation: 'gratitude',
        resources: Math.round(reciprocalValue * 100),
        public: originalGift.public
      }
    )

    originalGift.reciprocated = true

    // Reduce obligation
    const obligationReduced = originalGift.obligationCreated * reciprocationValue
    state.gratitude[originalGift.giver] = Math.max(0,
      (state.gratitude[originalGift.giver] || 0) - obligationReduced
    )

    // Reduce guilt from not reciprocating
    const guiltFromNotReciprocating = state.guiltFromNotReciprocating * 0.3
    state.guiltFromNotReciprocating -= guiltFromNotReciprocating

    // Update reciprocity reputation
    state.reciprocity = Math.min(1, state.reciprocity + 0.1)

    return {
      gift,
      obligationReduced,
      guiltReduced: guiltFromNotReciprocating
    }
  }

  /**
   * Fail to reciprocate (generates guilt)
   */
  failToReciprocate(
    state: GiftState,
    soulState: SoulState,
    giftId: string
  ): {
    guiltGenerated: number
    reputationLoss: number
  } {
    const gift = state.giftsReceived.find(g => g.id === giftId)
    if (!gift || !gift.reciprocityExpected) {
      return { guiltGenerated: 0, reputationLoss: 0 }
    }

    // Generate guilt based on obligation
    const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
    const guiltGenerated = gift.obligationCreated * guiltCapacity * 0.5

    state.guiltFromNotReciprocating += guiltGenerated

    // Reputation loss
    const reputationLoss = gift.obligationCreated * 0.2
    state.reciprocity = Math.max(0, state.reciprocity - reputationLoss)

    return {
      guiltGenerated,
      reputationLoss
    }
  }

  /**
   * Give excessive gifts to create obligation (manipulation)
   */
  async overwhelmWithGenerosity(
    state: GiftState,
    soulState: SoulState,
    learningState: LearningState | undefined,
    developmentState: DevelopmentState | undefined,
    target: string,
    intensity: number // 0-1
  ): Promise<{
    gifts: Gift[]
    totalObligation: number
    suspicionRisk: number
  }> {
    const giftsToGive = Math.ceil(intensity * 5) + 1
    const gifts: Gift[] = []
    let totalObligation = 0

    for (let i = 0; i < giftsToGive; i++) {
      const { gift, obligationCreated } = await this.give(
        state,
        soulState,
        learningState,
        developmentState,
        {
          type: 'resource',
          recipient: target,
          motivation: 'manipulation',
          hidden_motivation: 'manipulation',
          resources: Math.round((30 + Math.random() * 40) * intensity),
          public: false
        }
      )

      gifts.push(gift)
      totalObligation += obligationCreated
    }

    // Suspicion risk increases with excessive giving
    const suspicionRisk = intensity * 0.6

    return {
      gifts,
      totalObligation,
      suspicionRisk
    }
  }

  /**
   * Give guilt gift after wrongdoing
   */
  async giveGuiltGift(
    state: GiftState,
    soulState: SoulState,
    learningState: LearningState | undefined,
    developmentState: DevelopmentState | undefined,
    victim: string,
    wrongdoingSeverity: number
  ): Promise<{
    gift: Gift
    guiltReduced: number
    forgivenessProbability: number
  }> {
    // Gift value should match severity of wrongdoing
    const giftValue = Math.min(1, wrongdoingSeverity * 1.2)

    const { gift, guiltReduced } = await this.give(
      state,
      soulState,
      learningState,
      developmentState,
      {
        type: 'resource',
        recipient: victim,
        motivation: 'apology',
        resources: Math.round(giftValue * 100),
        public: false
      }
    )

    // Probability of forgiveness
    const forgivenessProbability = giftValue * 0.6

    return {
      gift,
      guiltReduced,
      forgivenessProbability
    }
  }

  /**
   * Check if gift is appropriate
   */
  private checkAppropriateness(
    motivation: GiftMotivation,
    value: number,
    soulState: SoulState,
    state: GiftState
  ): boolean {
    // Bribes are always somewhat inappropriate
    if (motivation === 'bribery') return false

    // Excessive gifts create discomfort
    if (value > 0.9 && motivation !== 'tribute') return false

    // Stingy apology gifts are inappropriate
    if (motivation === 'apology' && value < 0.3) return false

    // Otherwise appropriate
    return true
  }

  /**
   * Detect suspicion about hidden motivation
   */
  private detectSuspicion(gift: Gift, soulState: SoulState): number {
    let suspicion = 0

    // High wisdom detects manipulation
    if (gift.hidden_motivation && gift.hidden_motivation !== gift.motivation) {
      suspicion += soulState.shuangLing.current * 0.5
    }

    // Too generous raises suspicion
    if (gift.tooGenerous) {
      suspicion += 0.3
    }

    // Bribery motivation
    if (gift.motivation === 'bribery') {
      suspicion += 0.7
    }

    // High shadow people are more suspicious
    suspicion += soulState.shadowPressure * 0.2

    return Math.min(1, suspicion)
  }

  /**
   * Decide whether to accept gift
   */
  private shouldAcceptGift(gift: Gift, soulState: SoulState, suspicion: number): boolean {
    // Always reject obvious bribes if high guardian
    if (gift.motivation === 'bribery' && soulState.tunZei.current > 0.7) {
      return false
    }

    // Reject if culturally offensive
    if (gift.culturallyOffensive) {
      return Math.random() > 0.7
    }

    // Reject if suspicion is very high and guardian is strong
    if (suspicion > 0.7 && soulState.tunZei.current > 0.6) {
      return Math.random() < 0.3
    }

    // Otherwise accept
    return true
  }

  /**
   * Get unreciprocated gifts that are creating guilt
   */
  getUnreciprocalGifts(state: GiftState): Gift[] {
    return state.giftsReceived.filter(g =>
      g.reciprocityExpected &&
      !g.reciprocated &&
      g.accepted
    )
  }

  /**
   * Calculate total obligations owed to others
   */
  getTotalObligations(state: GiftState): number {
    return Object.values(state.obligations).reduce((sum, o) => sum + o, 0)
  }

  /**
   * Calculate total gratitude owed by others
   */
  getTotalGratitude(state: GiftState): number {
    return Object.values(state.gratitude).reduce((sum, g) => sum + g, 0)
  }
}
