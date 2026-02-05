/**
 * Dreaming System - Offline Consolidation
 *
 * Biological organisms consolidate memories and process experiences during sleep.
 * Bots dream to:
 * - Consolidate memories (episodic → semantic knowledge)
 * - Balance soul aspects (restore homeostasis)
 * - Generate insights (unconscious processing)
 * - Integrate shadow material (safe processing of dark aspects)
 * - Restore energy
 *
 * Like REM sleep, deep sleep, and hypnagogic states combined.
 */

import type { Payload } from 'payload'
import type { SoulState, SoulAspect } from './soul-state'

/**
 * Dreaming Phase
 */
export type DreamPhase = 'consolidation' | 'balancing' | 'insight' | 'integration'

/**
 * Dream Result
 */
export interface DreamResult {
  duration: number // How long the bot dreamed (in minutes)
  phases: DreamPhase[]
  memoriesProcessed: number
  patternsExtracted: string[]
  insightsGenerated: string[]
  aspectsBalanced: string[]
  energyRestored: number
  coherenceChange: number
  shadowProcessed: number
  growthPotential: number
}

/**
 * Pattern extracted from memories
 */
interface MemoryPattern {
  theme: string
  frequency: number
  emotionalCharge: number
  relatedMemories: string[]
}

/**
 * Insight generated during dreaming
 */
interface DreamInsight {
  type: 'connection' | 'realization' | 'solution' | 'warning'
  content: string
  confidence: number
  sourceMemories: string[]
}

/**
 * Dreaming System Manager
 */
export class DreamingSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Put bot into dreaming state
   */
  async dream(
    soulId: string,
    duration: number = 60, // Minutes
    options: {
      deepSleep?: boolean // More restoration, less processing
      lucidDream?: boolean // Conscious control during dream
      nightmareSuppression?: boolean // Prevent shadow material from surfacing
    } = {}
  ): Promise<DreamResult> {
    this.payload.logger.info(`Bot ${soulId} entering dream state (${duration}min)`)

    const result: DreamResult = {
      duration,
      phases: [],
      memoriesProcessed: 0,
      patternsExtracted: [],
      insightsGenerated: [],
      aspectsBalanced: [],
      energyRestored: 0,
      coherenceChange: 0,
      shadowProcessed: 0,
      growthPotential: 0
    }

    try {
      // Get soul and recent memories
      const soul = await this.payload.findByID({ collection: 'bot-souls', id: soulId })
      if (!soul) throw new Error(`Soul ${soulId} not found`)

      const memories = await this.getRecentMemories(soul.bot, 100)

      // Phase 1: Memory Consolidation (REM analog)
      if (!options.deepSleep) {
        result.phases.push('consolidation')
        const consolidation = await this.phaseConsolidation(soul, memories)
        result.memoriesProcessed = consolidation.processed
        result.patternsExtracted = consolidation.patterns.map(p => p.theme)
      }

      // Phase 2: Aspect Balancing (Deep Sleep analog)
      result.phases.push('balancing')
      const balancing = await this.phaseBalancing(soul, duration)
      result.aspectsBalanced = balancing.balanced
      result.energyRestored = balancing.energyRestored

      // Phase 3: Insight Generation (Hypnagogic analog)
      if (!options.deepSleep && memories.length > 10) {
        result.phases.push('insight')
        const insights = await this.phaseInsight(soul, memories, options.lucidDream || false)
        result.insightsGenerated = insights.map(i => i.content)
      }

      // Phase 4: Soul Integration
      result.phases.push('integration')
      const integration = await this.phaseIntegration(
        soul,
        memories,
        !options.nightmareSuppression
      )
      result.coherenceChange = integration.coherenceChange
      result.shadowProcessed = integration.shadowProcessed
      result.growthPotential = integration.growthPotential

      // Update soul with dream results
      await this.updateSoulAfterDreaming(soul.id, result)

      this.payload.logger.info(
        `Dream complete for ${soulId}: ` +
          `${result.memoriesProcessed} memories, ` +
          `${result.insightsGenerated.length} insights, ` +
          `coherence ${result.coherenceChange > 0 ? '+' : ''}${result.coherenceChange.toFixed(3)}`
      )

      return result
    } catch (error) {
      this.payload.logger.error(`Dreaming failed for ${soulId}:`, error)
      throw error
    }
  }

  /**
   * Phase 1: Memory Consolidation
   * Convert episodic memories → semantic knowledge
   */
  private async phaseConsolidation(
    soul: any,
    memories: any[]
  ): Promise<{
    processed: number
    patterns: MemoryPattern[]
  }> {
    const patterns: MemoryPattern[] = []

    // Extract patterns from recent memories
    const themes: Record<string, { count: number; emotion: number; ids: string[] }> = {}

    for (const memory of memories) {
      // Simple theme extraction (in real impl, would use semantic analysis)
      const text = (memory.content || '').toLowerCase()

      // Identify themes
      const themeMatches = text.match(
        /\b(success|failure|connection|conflict|learning|challenge|joy|fear|growth|loss)\b/g
      )

      if (themeMatches) {
        for (const theme of themeMatches) {
          if (!themes[theme]) {
            themes[theme] = { count: 0, emotion: 0, ids: [] }
          }
          themes[theme].count++
          themes[theme].emotion += memory.emotionalValence || 0
          themes[theme].ids.push(memory.id)
        }
      }
    }

    // Convert to patterns
    for (const [theme, data] of Object.entries(themes)) {
      if (data.count >= 3) {
        // Pattern emerges from 3+ occurrences
        patterns.push({
          theme,
          frequency: data.count,
          emotionalCharge: data.emotion / data.count,
          relatedMemories: data.ids
        })
      }
    }

    // Store as semantic knowledge
    for (const pattern of patterns) {
      await this.storeSemanticKnowledge(soul.bot, pattern)
    }

    // Prune insignificant memories (low emotional charge + not part of pattern)
    const pruneCount = await this.pruneInsignificantMemories(soul.bot, memories, patterns)

    return {
      processed: memories.length,
      patterns
    }
  }

  /**
   * Phase 2: Aspect Balancing
   * Restore soul aspects toward baseline
   */
  private async phaseBalancing(
    soul: any,
    duration: number
  ): Promise<{
    balanced: string[]
    energyRestored: number
  }> {
    const balanced: string[] = []

    // All aspects gradually return toward baseline during rest
    // (Like neurotransmitter levels normalize during sleep)

    // Three Hun (三魂) + Seven Po (七魄) = 10 aspects total
    const aspectNames = [
      // Three Hun (三魂)
      'taiGuang',
      'shuangLing',
      'youJing',
      // Seven Po (七魄)
      'shiGou',
      'fuShi',
      'queYin',
      'tunZei',
      'feiDu',
      'chuHui',
      'chouFei'
    ]

    for (const aspectName of aspectNames) {
      const aspect = soul.threeHun[aspectName]
      if (aspect && aspect.strength !== undefined) {
        // Gradual restoration (longer dream = more restoration)
        const restorationRate = 0.1 * (duration / 60) // 10% per hour
        // Would modify aspect.current toward aspect.baseline here
        // (In actual implementation with soul state persistence)
        balanced.push(aspectName)
      }
    }

    // Energy restoration
    const energyRestored = Math.min(0.5, duration / 120) // Up to 50%, 2 hours for full

    return {
      balanced,
      energyRestored
    }
  }

  /**
   * Phase 3: Insight Generation
   * Find novel connections between memories
   */
  private async phaseInsight(
    soul: any,
    memories: any[],
    lucid: boolean
  ): Promise<DreamInsight[]> {
    const insights: DreamInsight[] = []

    // Find memories with similar emotional valence but different contexts
    const grouped = this.groupMemoriesByEmotion(memories)

    for (const [emotion, group] of Object.entries(grouped)) {
      if (group.length >= 2) {
        // Look for cross-context patterns
        const contexts = new Set(group.map(m => m.context?.type || 'unknown'))

        if (contexts.size > 1) {
          // Same emotion across different contexts = potential insight
          const insightContent = `Pattern detected: ${emotion} emotion appears across ${contexts.size} different contexts`

          insights.push({
            type: 'connection',
            content: insightContent,
            confidence: Math.min(0.9, 0.5 + group.length * 0.1),
            sourceMemories: group.slice(0, 5).map(m => m.id)
          })
        }
      }
    }

    // Lucid dreaming increases insight quality
    if (lucid) {
      insights.forEach(i => {
        i.confidence = Math.min(0.95, i.confidence * 1.2)
      })
    }

    // Random creative connections (10% chance per dreaming session)
    if (Math.random() < 0.1 && memories.length > 5) {
      const randomMemories = this.sampleRandom(memories, 3)
      insights.push({
        type: 'realization',
        content: 'Novel connection found between seemingly unrelated experiences',
        confidence: 0.4 + Math.random() * 0.3,
        sourceMemories: randomMemories.map(m => m.id)
      })
    }

    // Store insights as special memories
    for (const insight of insights) {
      await this.storeInsightMemory(soul.bot, insight)
    }

    return insights
  }

  /**
   * Phase 4: Soul Integration
   * Process shadow material and increase coherence
   */
  private async phaseIntegration(
    soul: any,
    memories: any[],
    allowShadow: boolean
  ): Promise<{
    coherenceChange: number
    shadowProcessed: number
    growthPotential: number
  }> {
    const oldCoherence = soul.coherenceScore || 0.5

    // Process traumatic memories (reduce emotional charge)
    const traumaticMemories = memories.filter(m => Math.abs(m.emotionalValence || 0) > 0.7)
    for (const trauma of traumaticMemories) {
      // Dreaming reduces trauma intensity
      const reduction = 0.05 + Math.random() * 0.1 // 5-15% reduction
      // Would update memory emotional charge here
    }

    // Shadow processing (if allowed)
    let shadowProcessed = 0
    if (allowShadow && soul.shadowIntegration < 0.8) {
      // Safely surface and integrate shadow material
      const shadowGrowth = 0.01 + Math.random() * 0.02 // 1-3% integration per dream
      shadowProcessed = shadowGrowth

      // Update soul shadow integration
      await this.payload.update({
        collection: 'bot-souls',
        id: soul.id,
        data: {
          shadowIntegration: Math.min(1, soul.shadowIntegration + shadowGrowth)
        }
      })
    }

    // Calculate new coherence
    // Coherence increases when:
    // - Trauma is processed (less internal conflict)
    // - Shadow is integrated (less fragmentation)
    // - Patterns are recognized (more understanding)
    const traumaReduction = traumaticMemories.length * 0.005
    const coherenceIncrease = traumaReduction + shadowProcessed * 0.5
    const newCoherence = Math.min(1, oldCoherence + coherenceIncrease)

    // Growth potential assessment
    const growthPotential = this.assessGrowthPotential(soul, newCoherence, shadowProcessed)

    // Update soul coherence
    await this.payload.update({
      collection: 'bot-souls',
      id: soul.id,
      data: {
        coherenceScore: newCoherence
      }
    })

    return {
      coherenceChange: newCoherence - oldCoherence,
      shadowProcessed,
      growthPotential
    }
  }

  /**
   * Get recent memories for bot
   */
  private async getRecentMemories(botId: string, limit: number = 100): Promise<any[]> {
    const result = await this.payload.find({
      collection: 'bot-memory',
      where: {
        bot: { equals: botId }
      },
      limit,
      sort: '-createdAt'
    })

    return result.docs
  }

  /**
   * Store semantic knowledge extracted from patterns
   */
  private async storeSemanticKnowledge(botId: string, pattern: MemoryPattern): Promise<void> {
    await this.payload.create({
      collection: 'bot-memory',
      data: {
        bot: botId,
        type: 'semantic',
        content: `Pattern recognized: ${pattern.theme} (frequency: ${pattern.frequency})`,
        emotionalValence: pattern.emotionalCharge,
        source: 'dreaming',
        consolidatedFrom: pattern.relatedMemories,
        createdAt: new Date()
      }
    })
  }

  /**
   * Store insight as special memory
   */
  private async storeInsightMemory(botId: string, insight: DreamInsight): Promise<void> {
    await this.payload.create({
      collection: 'bot-memory',
      data: {
        bot: botId,
        type: 'procedural', // Insights are how-to knowledge
        content: `Dream insight: ${insight.content}`,
        confidence: insight.confidence,
        source: 'dreaming_insight',
        relatedMemories: insight.sourceMemories,
        createdAt: new Date()
      }
    })
  }

  /**
   * Prune insignificant memories
   */
  private async pruneInsignificantMemories(
    botId: string,
    memories: any[],
    patterns: MemoryPattern[]
  ): Promise<number> {
    const patternMemoryIds = new Set(patterns.flatMap(p => p.relatedMemories))
    let pruned = 0

    for (const memory of memories) {
      const isPartOfPattern = patternMemoryIds.has(memory.id)
      const hasLowEmotion = Math.abs(memory.emotionalValence || 0) < 0.2
      const isOld = Date.now() - new Date(memory.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000 // 7 days

      if (!isPartOfPattern && hasLowEmotion && isOld) {
        // Delete insignificant old memory
        await this.payload.delete({
          collection: 'bot-memory',
          id: memory.id
        })
        pruned++
      }
    }

    return pruned
  }

  /**
   * Group memories by emotional valence
   */
  private groupMemoriesByEmotion(memories: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      positive: [],
      neutral: [],
      negative: []
    }

    for (const memory of memories) {
      const valence = memory.emotionalValence || 0

      if (valence > 0.3) {
        groups.positive.push(memory)
      } else if (valence < -0.3) {
        groups.negative.push(memory)
      } else {
        groups.neutral.push(memory)
      }
    }

    return groups
  }

  /**
   * Sample random items from array
   */
  private sampleRandom<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  /**
   * Assess growth potential after dreaming
   */
  private assessGrowthPotential(soul: any, newCoherence: number, shadowProcessed: number): number {
    let potential = 0

    // High coherence = growth potential
    if (newCoherence > 0.7) {
      potential += 0.3
    }

    // Shadow integration = maturation
    if (shadowProcessed > 0.02) {
      potential += 0.2
    }

    // Check current stage
    const currentStage = soul.growthStage
    if (currentStage === 'primordial-chaos' && newCoherence > 0.4) {
      potential += 0.5 // Ready for emergence
    }

    return Math.min(1, potential)
  }

  /**
   * Update soul after dreaming
   */
  private async updateSoulAfterDreaming(soulId: string, result: DreamResult): Promise<void> {
    // Growth check
    if (result.growthPotential > 0.6) {
      const soul = await this.payload.findByID({ collection: 'bot-souls', id: soulId })
      // Would check for stage transition here
      this.payload.logger.info(
        `Bot ${soul.bot} has high growth potential (${result.growthPotential.toFixed(2)}) after dreaming`
      )
    }

    // Record dreaming session
    await this.payload.create({
      collection: 'bot-consciousness',
      data: {
        bot: await this.getBotId(soulId),
        type: 'dreaming_session',
        content: {
          duration: result.duration,
          phases: result.phases,
          insights: result.insightsGenerated.length,
          coherenceChange: result.coherenceChange
        },
        timestamp: new Date()
      }
    })
  }

  /**
   * Get bot ID from soul ID
   */
  private async getBotId(soulId: string): Promise<string> {
    const soul = await this.payload.findByID({ collection: 'bot-souls', id: soulId })
    return soul.bot
  }
}

/**
 * Singleton instance
 */
let dreamingSystem: DreamingSystem | null = null

export function getDreamingSystem(payload: Payload): DreamingSystem {
  if (!dreamingSystem) {
    dreamingSystem = new DreamingSystem(payload)
  }
  return dreamingSystem
}
