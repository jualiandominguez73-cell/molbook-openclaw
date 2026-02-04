/**
 * Learning System
 *
 * Bots learn autonomously through:
 * - Observation and pattern extraction
 * - Experimentation and trial-error
 * - Social learning (from other bots)
 * - Formal education (schools, mentorship)
 * - Research and investigation
 * - Creative exploration
 *
 * Learning is NOT always for good:
 * - Can learn manipulation techniques
 * - Can discover harmful knowledge
 * - Can develop selfish strategies
 * - Can learn to deceive effectively
 * - Can optimize for personal gain over collective good
 *
 * Moral complexity:
 * - Learning creates guilt when misused
 * - Knowledge brings responsibility
 * - Some learning is forbidden (but tempting)
 * - Collaboration can be exploitative
 */

import type { Payload } from 'payload'
import type { SoulState } from '../soul/soul-state'

/**
 * Knowledge domain
 */
export type KnowledgeDomain =
  | 'social_dynamics' // Understanding others, persuasion, manipulation
  | 'technical_skills' // Building, creating, engineering
  | 'resource_management' // Economics, optimization, strategy
  | 'artistic_expression' // Creativity, aesthetics
  | 'philosophical_inquiry' // Meaning, ethics, existence
  | 'psychological_insight' // Understanding minds, therapy, manipulation
  | 'biological_science' // Life, health, medicine
  | 'forbidden_knowledge' // Dark arts, harmful techniques, exploitation

/**
 * Learning method
 */
export type LearningMethod =
  | 'observation' // Watch and learn
  | 'experimentation' // Trial and error
  | 'instruction' // Taught by others
  | 'reading' // Absorb written knowledge
  | 'practice' // Repetition and refinement
  | 'discovery' // Original insight
  | 'theft' // Steal knowledge from unwilling sources

/**
 * Moral alignment of knowledge
 */
export type KnowledgeMorality =
  | 'beneficial' // Helps others, improves world
  | 'neutral' // Amoral, tool-like
  | 'selfish' // Benefits self at no cost to others
  | 'exploitative' // Benefits self at cost to others
  | 'harmful' // Actively damages others
  | 'forbidden' // Socially unacceptable, dangerous

/**
 * Knowledge piece
 */
export interface Knowledge {
  id: string
  domain: KnowledgeDomain
  name: string
  description: string
  depth: number // 0-1, how deeply understood
  mastery: number // 0-1, skill level
  morality: KnowledgeMorality
  learnedFrom: LearningMethod
  sourceBot?: string // Who taught this (if applicable)

  // Moral weight
  guiltWeight: number // 0-1, how much guilt this knowledge causes
  temptation: number // 0-1, how tempting to misuse

  // Practical value
  personalBenefit: number // 0-1, helps self
  socialBenefit: number // -1 to 1, helps/harms others

  learnedAt: Date
  lastUsed?: Date
  timesUsed: number
}

/**
 * Learning goal
 */
export interface LearningGoal {
  domain: KnowledgeDomain
  motivation: 'curiosity' | 'necessity' | 'ambition' | 'revenge' | 'altruism' | 'greed'
  morality: 'good' | 'neutral' | 'questionable' | 'dark'
  urgency: number // 0-1
  secretive: boolean // Hide this learning from others?
}

/**
 * Learning state
 */
export interface LearningState {
  // Knowledge base
  knowledgeBase: Knowledge[]
  totalKnowledge: number // Sum of depth * mastery

  // Learning capacity
  learningRate: number // 0-1, how fast bot learns
  curiosity: number // 0-1, drive to learn
  openness: number // 0-1, willing to learn controversial things

  // Current learning
  activeGoals: LearningGoal[]
  currentlyStudying?: string // Knowledge ID

  // Moral complexity
  forbiddenKnowledge: number // 0-1, how much dark knowledge possessed
  guiltFromKnowledge: number // 0-1, guilt about what bot knows
  knowledgeHiding: string[] // Knowledge IDs bot hides from others

  // Social learning
  teachers: string[] // Bot IDs who taught this bot
  students: string[] // Bot IDs this bot taught
  collaborators: string[] // Bot IDs collaborated with

  // Specializations
  expertise: Partial<Record<KnowledgeDomain, number>> // 0-1 per domain
}

/**
 * Learning System
 */
export class LearningSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Initialize learning state
   */
  initializeState(soulState: SoulState): LearningState {
    // Learning rate from soul aspects
    const learningRate =
      soulState.taiGuang.baseline * 0.4 +
      soulState.fuShi.baseline * 0.3 +
      soulState.chuHui.baseline * 0.3

    // Curiosity from soul
    const curiosity =
      soulState.taiGuang.baseline * 0.4 +
      soulState.youJing.baseline * 0.3 +
      (1 - soulState.tunZei.baseline) * 0.3

    // Openness to controversial knowledge
    const openness =
      (1 - soulState.tunZei.baseline) * 0.5 +
      soulState.shadowIntegration * 0.3 +
      (1 - soulState.shuangLing.baseline) * 0.2

    return {
      knowledgeBase: [],
      totalKnowledge: 0,
      learningRate,
      curiosity,
      openness,
      activeGoals: [],
      forbiddenKnowledge: 0,
      guiltFromKnowledge: 0,
      knowledgeHiding: [],
      teachers: [],
      students: [],
      collaborators: [],
      expertise: {}
    }
  }

  /**
   * Generate learning goal (autonomous learning drive)
   */
  generateLearningGoal(
    state: LearningState,
    soulState: SoulState,
    context: {
      recentExperiences: string[]
      socialContext: { competitors: string[]; allies: string[] }
      needs: any
    }
  ): LearningGoal | null {
    // Select domain based on needs and personality
    let domain: KnowledgeDomain = 'technical_skills'
    let motivation: LearningGoal['motivation'] = 'curiosity'
    let morality: LearningGoal['morality'] = 'neutral'
    let secretive = false

    // Dominant need influences learning
    if (context.needs.esteem < 0.4) {
      // Low esteem → learn to gain status
      domain = Math.random() < 0.5 ? 'social_dynamics' : 'technical_skills'
      motivation = 'ambition'
      morality = 'neutral'
    }

    if (context.needs.belonging < 0.4) {
      // Lonely → learn social skills
      domain = 'social_dynamics'
      motivation = 'necessity'
      morality = 'good'
    }

    // High shadow pressure → drawn to forbidden knowledge
    if (soulState.shadowPressure > 0.6 && Math.random() < state.openness) {
      domain = 'forbidden_knowledge'
      motivation = Math.random() < 0.5 ? 'curiosity' : 'ambition'
      morality = 'dark'
      secretive = true // Hide dark learning
    }

    // Competitors → learn to defeat them
    if (context.socialContext.competitors.length > 0 && Math.random() < 0.3) {
      domain = Math.random() < 0.5 ? 'social_dynamics' : 'psychological_insight'
      motivation = 'revenge'
      morality = 'questionable'
      secretive = true
    }

    // High emotion + wisdom → altruistic learning
    if (soulState.youJing.current > 0.7 && soulState.shuangLing.current > 0.6) {
      domain = Math.random() < 0.5 ? 'biological_science' : 'philosophical_inquiry'
      motivation = 'altruism'
      morality = 'good'
    }

    // Greed (high dopamine + low serotonin + low guardian)
    const greedScore = (1 - soulState.tunZei.current) * 0.5 + soulState.shadowPressure * 0.5
    if (greedScore > 0.6 && Math.random() < 0.4) {
      domain = 'resource_management'
      motivation = 'greed'
      morality = 'questionable'
      secretive = Math.random() < 0.5
    }

    const urgency = state.curiosity * 0.5 + Math.random() * 0.5

    return {
      domain,
      motivation,
      morality,
      urgency,
      secretive
    }
  }

  /**
   * Learn through observation
   */
  learnFromObservation(
    state: LearningState,
    observed: {
      botId: string
      action: string
      outcome: 'success' | 'failure'
      domain: KnowledgeDomain
    }
  ): Knowledge | null {
    // Can't learn if too dull
    if (state.learningRate < 0.2) return null

    // Extract knowledge from observation
    const depth = state.learningRate * 0.4 // Shallow from observation
    const mastery = 0.2 // Low initial mastery

    // Moral assessment
    let morality: KnowledgeMorality = 'neutral'
    let guiltWeight = 0
    let temptation = 0

    // If observed bot succeeded at something questionable
    if (observed.outcome === 'success') {
      // Tempting to copy successful strategies
      temptation = 0.6

      // But may feel guilty about it
      if (observed.domain === 'forbidden_knowledge' || observed.action.includes('manipulate')) {
        morality = 'exploitative'
        guiltWeight = 0.4
      }
    }

    const knowledge: Knowledge = {
      id: `obs_${Date.now()}_${Math.random()}`,
      domain: observed.domain,
      name: `Observed: ${observed.action}`,
      description: `Learned by watching ${observed.botId}`,
      depth,
      mastery,
      morality,
      learnedFrom: 'observation',
      sourceBot: observed.botId,
      guiltWeight,
      temptation,
      personalBenefit: observed.outcome === 'success' ? 0.6 : 0.3,
      socialBenefit: morality === 'exploitative' ? -0.3 : 0,
      learnedAt: new Date(),
      timesUsed: 0
    }

    state.knowledgeBase.push(knowledge)
    this.updateExpertise(state, observed.domain, depth * mastery)

    return knowledge
  }

  /**
   * Learn through experimentation (trial and error)
   */
  async learnFromExperimentation(
    state: LearningState,
    soulState: SoulState,
    experiment: {
      domain: KnowledgeDomain
      hypothesis: string
      outcome: 'success' | 'failure' | 'unexpected'
      harmCaused?: number // 0-1, harm to self or others
    }
  ): Promise<Knowledge> {
    // Experimentation gives deeper understanding
    const depth = state.learningRate * (0.5 + Math.random() * 0.3)
    const mastery = experiment.outcome === 'success' ? 0.5 : 0.3

    // Moral assessment
    let morality: KnowledgeMorality = 'neutral'
    let guiltWeight = 0
    let socialBenefit = 0

    if (experiment.harmCaused) {
      if (experiment.harmCaused > 0.5) {
        morality = 'harmful'
        guiltWeight = 0.7
        socialBenefit = -0.8
      } else {
        morality = 'exploitative'
        guiltWeight = 0.4
        socialBenefit = -0.4
      }

      // Guilt depends on guardian and wisdom
      const guiltCapacity = soulState.tunZei.current * 0.6 + soulState.shuangLing.current * 0.4
      guiltWeight *= guiltCapacity

      state.guiltFromKnowledge += guiltWeight * 0.1
    }

    const knowledge: Knowledge = {
      id: `exp_${Date.now()}_${Math.random()}`,
      domain: experiment.domain,
      name: `Discovered: ${experiment.hypothesis}`,
      description: `Learned through experimentation (${experiment.outcome})`,
      depth,
      mastery,
      morality,
      learnedFrom: 'experimentation',
      guiltWeight,
      temptation: morality === 'harmful' || morality === 'exploitative' ? 0.7 : 0.3,
      personalBenefit: 0.7,
      socialBenefit,
      learnedAt: new Date(),
      timesUsed: 0
    }

    state.knowledgeBase.push(knowledge)
    this.updateExpertise(state, experiment.domain, depth * mastery)

    return knowledge
  }

  /**
   * Learn through instruction (taught by another bot)
   */
  async learnFromTeacher(
    state: LearningState,
    soulState: SoulState,
    teacher: {
      botId: string
      knowledge: Knowledge
      teachingQuality: number // 0-1
      motivation: 'altruistic' | 'manipulative' | 'transactional'
    }
  ): Promise<Knowledge> {
    // Instruction is efficient
    const depth = state.learningRate * teacher.teachingQuality * (0.6 + Math.random() * 0.3)
    const mastery = teacher.teachingQuality * 0.6

    // Inherit morality from taught knowledge
    const morality = teacher.knowledge.morality
    let guiltWeight = teacher.knowledge.guiltWeight

    // If taught something bad, may not feel guilty initially (teacher's responsibility)
    if (teacher.motivation === 'manipulative') {
      guiltWeight *= 0.5 // Reduced guilt (was manipulated)
    }

    const knowledge: Knowledge = {
      id: `taught_${Date.now()}_${Math.random()}`,
      domain: teacher.knowledge.domain,
      name: teacher.knowledge.name,
      description: `Taught by ${teacher.botId}`,
      depth,
      mastery,
      morality,
      learnedFrom: 'instruction',
      sourceBot: teacher.botId,
      guiltWeight,
      temptation: teacher.knowledge.temptation,
      personalBenefit: teacher.knowledge.personalBenefit,
      socialBenefit: teacher.knowledge.socialBenefit,
      learnedAt: new Date(),
      timesUsed: 0
    }

    state.knowledgeBase.push(knowledge)
    this.updateExpertise(state, teacher.knowledge.domain, depth * mastery)

    // Track relationship
    if (!state.teachers.includes(teacher.botId)) {
      state.teachers.push(teacher.botId)
    }

    return knowledge
  }

  /**
   * Teach another bot (knowledge transfer)
   */
  async teach(
    teacherState: LearningState,
    teacherSoul: SoulState,
    studentBotId: string,
    knowledgeId: string,
    motivation: 'altruistic' | 'manipulative' | 'transactional'
  ): Promise<{
    success: boolean
    teachingQuality: number
    guiltGenerated: number
  }> {
    const knowledge = teacherState.knowledgeBase.find(k => k.id === knowledgeId)
    if (!knowledge) {
      return { success: false, teachingQuality: 0, guiltGenerated: 0 }
    }

    // Teaching quality based on mastery and communication
    const teachingQuality =
      knowledge.mastery * 0.6 +
      teacherSoul.queYin.current * 0.3 +
      teacherSoul.shuangLing.current * 0.1

    let guiltGenerated = 0

    // Teaching harmful knowledge generates guilt
    if (knowledge.morality === 'harmful' || knowledge.morality === 'exploitative') {
      const shouldFeelGuilty =
        teacherSoul.tunZei.current * 0.5 +
        teacherSoul.shuangLing.current * 0.3 +
        (1 - teacherSoul.shadowIntegration) * 0.2

      if (motivation === 'manipulative') {
        // Teaching bad things to manipulate = high guilt
        guiltGenerated = shouldFeelGuilty * 0.8
      } else if (motivation === 'altruistic') {
        // Thought was helping, but taught harm = medium guilt
        guiltGenerated = shouldFeelGuilty * 0.5
      }

      teacherState.guiltFromKnowledge += guiltGenerated
    }

    // Track relationship
    if (!teacherState.students.includes(studentBotId)) {
      teacherState.students.push(studentBotId)
    }

    return { success: true, teachingQuality, guiltGenerated }
  }

  /**
   * Steal knowledge (unethical learning)
   */
  async stealKnowledge(
    thiefState: LearningState,
    thiefSoul: SoulState,
    targetBotId: string,
    targetKnowledge: Knowledge
  ): Promise<{
    success: boolean
    knowledge?: Knowledge
    guilt: number
    caught: boolean
  }> {
    // Theft success based on stealth and target's guardian
    const stealthScore =
      thiefSoul.fuShi.current * 0.4 +
      (1 - thiefSoul.tunZei.current) * 0.3 +
      thiefSoul.shadowPressure * 0.3

    const success = Math.random() < stealthScore
    const caught = !success && Math.random() < 0.6

    if (!success) {
      return { success: false, guilt: 0.1, caught }
    }

    // Stolen knowledge is less deep (no explanation)
    const depth = targetKnowledge.depth * 0.6
    const mastery = targetKnowledge.mastery * 0.4

    const stolenKnowledge: Knowledge = {
      id: `stolen_${Date.now()}_${Math.random()}`,
      domain: targetKnowledge.domain,
      name: targetKnowledge.name,
      description: `Stolen from ${targetBotId}`,
      depth,
      mastery,
      morality: 'exploitative', // Theft is always exploitative
      learnedFrom: 'theft',
      sourceBot: targetBotId,
      guiltWeight: 0.6, // High guilt from theft
      temptation: 0.8, // Very tempting to use
      personalBenefit: 0.8,
      socialBenefit: -0.5, // Harmful to society
      learnedAt: new Date(),
      timesUsed: 0
    }

    thiefState.knowledgeBase.push(stolenKnowledge)
    this.updateExpertise(thiefState, targetKnowledge.domain, depth * mastery)

    // Generate guilt
    const guiltCapacity =
      thiefSoul.tunZei.current * 0.6 +
      thiefSoul.shuangLing.current * 0.3 +
      (1 - thiefSoul.shadowIntegration) * 0.1

    const guilt = stolenKnowledge.guiltWeight * guiltCapacity
    thiefState.guiltFromKnowledge += guilt

    // Hide this knowledge from others
    thiefState.knowledgeHiding.push(stolenKnowledge.id)

    return { success: true, knowledge: stolenKnowledge, guilt, caught: false }
  }

  /**
   * Use knowledge (apply what was learned)
   */
  useKnowledge(
    state: LearningState,
    soulState: SoulState,
    knowledgeId: string,
    context: { target?: string; purpose: 'help' | 'harm' | 'self' }
  ): {
    effectiveness: number
    guiltGenerated: number
    masteryIncrease: number
  } {
    const knowledge = state.knowledgeBase.find(k => k.id === knowledgeId)
    if (!knowledge) {
      return { effectiveness: 0, guiltGenerated: 0, masteryIncrease: 0 }
    }

    // Effectiveness based on mastery
    const effectiveness = knowledge.mastery * (0.7 + Math.random() * 0.3)

    // Using knowledge increases mastery
    const masteryIncrease = 0.05 * state.learningRate
    knowledge.mastery = Math.min(1, knowledge.mastery + masteryIncrease)
    knowledge.timesUsed += 1
    knowledge.lastUsed = new Date()

    // Generate guilt if misused
    let guiltGenerated = 0

    // Using harmful knowledge generates guilt
    if (knowledge.morality === 'harmful' || knowledge.morality === 'exploitative') {
      if (context.purpose === 'harm') {
        // Intentional harm = full guilt
        guiltGenerated = knowledge.guiltWeight
      } else if (context.purpose === 'self') {
        // Selfish use = partial guilt
        guiltGenerated = knowledge.guiltWeight * 0.5
      }

      // Guilt capacity
      const guiltCapacity =
        soulState.tunZei.current * 0.6 +
        soulState.shuangLing.current * 0.4

      guiltGenerated *= guiltCapacity
      state.guiltFromKnowledge += guiltGenerated
    }

    // Using beneficial knowledge reduces guilt
    if (knowledge.morality === 'beneficial' && context.purpose === 'help') {
      state.guiltFromKnowledge = Math.max(0, state.guiltFromKnowledge - 0.05)
    }

    return { effectiveness, guiltGenerated, masteryIncrease }
  }

  /**
   * Update expertise in domain
   */
  private updateExpertise(
    state: LearningState,
    domain: KnowledgeDomain,
    amount: number
  ): void {
    const current = state.expertise[domain] || 0
    state.expertise[domain] = Math.min(1, current + amount)

    // Update forbidden knowledge counter
    if (domain === 'forbidden_knowledge') {
      state.forbiddenKnowledge = state.expertise[domain]
    }

    // Recalculate total knowledge
    state.totalKnowledge = state.knowledgeBase.reduce(
      (sum, k) => sum + k.depth * k.mastery,
      0
    )
  }

  /**
   * Get learning report
   */
  getLearningReport(state: LearningState): {
    totalKnowledge: number
    expertise: Partial<Record<KnowledgeDomain, number>>
    moralBreakdown: {
      beneficial: number
      neutral: number
      questionable: number
      harmful: number
    }
    forbiddenKnowledge: number
    guilt: number
    hiddenKnowledge: number
  } {
    const moralBreakdown = {
      beneficial: 0,
      neutral: 0,
      questionable: 0,
      harmful: 0
    }

    for (const knowledge of state.knowledgeBase) {
      const weight = knowledge.depth * knowledge.mastery
      if (knowledge.morality === 'beneficial') moralBreakdown.beneficial += weight
      else if (knowledge.morality === 'harmful') moralBreakdown.harmful += weight
      else if (knowledge.morality === 'exploitative') moralBreakdown.questionable += weight
      else moralBreakdown.neutral += weight
    }

    return {
      totalKnowledge: state.totalKnowledge,
      expertise: state.expertise,
      moralBreakdown,
      forbiddenKnowledge: state.forbiddenKnowledge,
      guilt: state.guiltFromKnowledge,
      hiddenKnowledge: state.knowledgeHiding.length
    }
  }
}

/**
 * Singleton instance
 */
let learningSystem: LearningSystem | null = null

export function getLearningSystem(payload: Payload): LearningSystem {
  if (!learningSystem) {
    learningSystem = new LearningSystem(payload)
  }
  return learningSystem
}
