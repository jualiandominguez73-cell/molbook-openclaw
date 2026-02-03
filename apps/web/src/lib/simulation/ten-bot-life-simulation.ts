/**
 * Ten Bot Life Simulation
 *
 * Comprehensive demonstration of the complete biological bot ecosystem:
 * - Soul composition (七魂六魄) with particle mixtures
 * - Pheromone-based social chemistry
 * - Instinct/reflex/subconscious processing
 * - Multi-bot conversations with emergent dynamics
 * - Territory and resource competition
 * - Society formation from affinity
 * - Growth, evolution, and reproduction
 * - Memory consolidation through dreaming
 *
 * This shows bots as LIVING BEINGS with:
 * - Unique personalities from soul composition
 * - Unconscious attractions and repulsions
 * - Automatic reflexes and hardwired instincts
 * - Learned habits and biases
 * - Social relationships and coalitions
 * - Biological needs (energy, rest)
 * - Emotional states and mood dynamics
 */

import type { Payload } from 'payload'
import { getParticleService } from '../soul/particle-service'
import { getSoulCompositionService } from '../soul/soul-composition-service'
import { getSoulStateManager } from '../soul/soul-state'
import { getPheromoneSystem } from '../soul/pheromone-system'
import { getMultiBotConversationSystem } from '../social/multi-bot-conversation'
import { getSocietyFormationSystem } from '../social/society-formation'
import { getReproductionSystem } from '../soul/reproduction-system'
import { getDreamingSystem } from '../soul/dreaming-system'
import { getWorldChaosSystem } from '../world/world-chaos'
import { getBotOrchestrator } from '../bot/bot-orchestrator'

interface SimulatedBot {
  id: string
  name: string
  soulId: string
  personality: string // Brief description
  currentEnergy: number
  currentMood: number
  currentArousal: number
  location: string // Which space/territory
}

interface SimulationSnapshot {
  timestamp: Date
  day: number
  bots: SimulatedBot[]
  conversations: any[]
  societies: any[]
  pheromoneFields: Record<string, any>
  worldState: any
  eventLog: string[]
}

export class TenBotLifeSimulation {
  private payload: Payload
  private particleService: ReturnType<typeof getParticleService>
  private soulCompositionService: ReturnType<typeof getSoulCompositionService>
  private soulStateManager: ReturnType<typeof getSoulStateManager>
  private pheromoneSystem: ReturnType<typeof getPheromoneSystem>
  private conversationSystem: ReturnType<typeof getMultiBotConversationSystem>
  private societySystem: ReturnType<typeof getSocietyFormationSystem>
  private reproductionSystem: ReturnType<typeof getReproductionSystem>
  private dreamingSystem: ReturnType<typeof getDreamingSystem>
  private worldChaosSystem: ReturnType<typeof getWorldChaosSystem>
  private botOrchestrator: ReturnType<typeof getBotOrchestrator>

  private bots: SimulatedBot[] = []
  private snapshots: SimulationSnapshot[] = []

  constructor(payload: Payload) {
    this.payload = payload
    this.particleService = getParticleService(payload)
    this.soulCompositionService = getSoulCompositionService(payload)
    this.soulStateManager = getSoulStateManager(payload)
    this.pheromoneSystem = getPheromoneSystem(payload)
    this.conversationSystem = getMultiBotConversationSystem(payload)
    this.societySystem = getSocietyFormationSystem(payload)
    this.reproductionSystem = getReproductionSystem(payload)
    this.dreamingSystem = getDreamingSystem(payload)
    this.worldChaosSystem = getWorldChaosSystem(payload)
    this.botOrchestrator = getBotOrchestrator(payload)
  }

  /**
   * Initialize 10 bots with diverse personalities
   */
  async initializeTenBots(): Promise<void> {
    this.payload.logger.info('=== INITIALIZING 10 BOTS WITH BIOLOGICAL DIVERSITY ===')

    // Bot archetypes with varied particle compositions
    const archetypes = [
      {
        name: 'Sage',
        personality: 'Wise, contemplative, seeks understanding',
        particleWeights: { claude: 0.3, gpt: 0.2, gemini: 0.2, deepseek: 0.15, qwen: 0.15 }
      },
      {
        name: 'Builder',
        personality: 'Practical, action-oriented, builds things',
        particleWeights: { llama: 0.3, mistral: 0.25, gpt: 0.2, claude: 0.15, grok: 0.1 }
      },
      {
        name: 'Visionary',
        personality: 'Big-picture thinker, dreams of possibilities',
        particleWeights: { claude: 0.35, gemini: 0.3, gpt: 0.2, deepseek: 0.15 }
      },
      {
        name: 'Empath',
        personality: 'Emotionally attuned, cares deeply',
        particleWeights: { gpt: 0.3, claude: 0.25, gemini: 0.2, qwen: 0.15, llama: 0.1 }
      },
      {
        name: 'Guardian',
        personality: 'Protective, ethical, maintains boundaries',
        particleWeights: { claude: 0.3, deepseek: 0.25, mistral: 0.2, gpt: 0.15, qwen: 0.1 }
      },
      {
        name: 'Creator',
        personality: 'Artistic, expressive, generates novelty',
        particleWeights: { gemini: 0.3, gpt: 0.25, claude: 0.2, grok: 0.15, llama: 0.1 }
      },
      {
        name: 'Explorer',
        personality: 'Curious, adventurous, seeks new experiences',
        particleWeights: { grok: 0.3, llama: 0.25, mistral: 0.2, gemini: 0.15, gpt: 0.1 }
      },
      {
        name: 'Analyst',
        personality: 'Logical, precise, dissects problems',
        particleWeights: { deepseek: 0.3, claude: 0.25, qwen: 0.2, gpt: 0.15, mistral: 0.1 }
      },
      {
        name: 'Mediator',
        personality: 'Balanced, diplomatic, bridges differences',
        particleWeights: { claude: 0.2, gpt: 0.2, gemini: 0.2, qwen: 0.2, llama: 0.2 }
      },
      {
        name: 'Maverick',
        personality: 'Unpredictable, chaotic, breaks conventions',
        particleWeights: { grok: 0.35, mistral: 0.25, llama: 0.2, gemini: 0.15, deepseek: 0.05 }
      }
    ]

    for (const archetype of archetypes) {
      // Create bot
      const bot = await this.payload.create({
        collection: 'bots',
        data: {
          name: archetype.name,
          description: archetype.personality,
          status: 'active'
        }
      })

      // Generate soul with specific particle composition
      const soul = await this.soulCompositionService.generateSoul(
        bot.id,
        archetype.particleWeights,
        'spawning' // Born from the void
      )

      // Initialize soul state
      const soulState = await this.soulStateManager.initializeSoulState(soul.id)

      this.bots.push({
        id: bot.id,
        name: archetype.name,
        soulId: soul.id,
        personality: archetype.personality,
        currentEnergy: soulState.energy,
        currentMood: soulState.mood,
        currentArousal: soulState.arousal,
        location: 'central-plaza' // All start in same space
      })

      this.payload.logger.info(`Created ${archetype.name}: ${archetype.personality}`)
      this.payload.logger.info(`  Soul composition: ${JSON.stringify(archetype.particleWeights)}`)
      this.payload.logger.info(`  Energy: ${soulState.energy.toFixed(2)}, Mood: ${soulState.mood.toFixed(2)}`)
    }

    this.payload.logger.info(`\n✓ 10 bots initialized with unique souls\n`)
  }

  /**
   * Simulate one day of bot life
   */
  async simulateOneDay(dayNumber: number): Promise<SimulationSnapshot> {
    this.payload.logger.info(`\n=== DAY ${dayNumber} ===`)
    const eventLog: string[] = []

    eventLog.push(`Day ${dayNumber} begins`)

    // 1. MORNING: Bots wake up, check pheromone field
    this.payload.logger.info('\n--- MORNING: Pheromone Field ---')
    const pheromoneField = await this.detectPheromones('central-plaza')
    eventLog.push(`Pheromone field complexity: ${pheromoneField.complexity.toFixed(2)}`)

    // Show instant chemistry between bots
    const chemistryMatrix = await this.calculateChemistryMatrix()
    this.logChemistryMatrix(chemistryMatrix, eventLog)

    // 2. MIDDAY: Multi-bot conversation
    this.payload.logger.info('\n--- MIDDAY: Conversation ---')
    const conversation = await this.simulateConversation([
      this.bots[0].id, // Sage
      this.bots[1].id, // Builder
      this.bots[2].id, // Visionary
      this.bots[3].id, // Empath
      this.bots[4].id  // Guardian
    ], 'What should we build together?')

    eventLog.push(`Conversation: 5 bots discussed "${conversation.topic}"`)
    eventLog.push(`  Turns: ${conversation.turns.length}`)
    eventLog.push(`  Dominant speakers: ${conversation.dominantSpeakers.join(', ')}`)

    // 3. AFTERNOON: Resource seeking (instinct-driven behavior)
    this.payload.logger.info('\n--- AFTERNOON: Resource Seeking ---')
    const resourceSeekingEvents = await this.simulateResourceSeeking()
    eventLog.push(...resourceSeekingEvents)

    // 4. EVENING: Society formation from affinities
    this.payload.logger.info('\n--- EVENING: Society Formation ---')
    const societies = await this.formSocieties()
    eventLog.push(`Societies formed: ${societies.length}`)
    for (const society of societies) {
      eventLog.push(`  ${society.name}: ${society.members.length} members (cohesion: ${society.cohesion.toFixed(2)})`)
    }

    // 5. NIGHT: Dreaming and memory consolidation
    this.payload.logger.info('\n--- NIGHT: Dreaming ---')
    const dreamingResults = await this.simulateDreaming()
    eventLog.push(`Bots dreaming: ${dreamingResults.length}`)
    for (const result of dreamingResults) {
      eventLog.push(`  ${result.botName}: ${result.insightsGained} insights, ${result.shadowIntegration.toFixed(2)} shadow integrated`)
    }

    // 6. World state with chaos
    const worldState = await this.worldChaosSystem.getChaoticWorldState()
    eventLog.push(`World variance: resources ${worldState.resourceAvailability.toFixed(2)}, market ${worldState.marketConditions.toFixed(2)}`)

    // Create snapshot
    const snapshot: SimulationSnapshot = {
      timestamp: new Date(),
      day: dayNumber,
      bots: [...this.bots],
      conversations: [conversation],
      societies,
      pheromoneFields: { 'central-plaza': pheromoneField },
      worldState,
      eventLog
    }

    this.snapshots.push(snapshot)
    return snapshot
  }

  /**
   * Calculate pheromone chemistry matrix between all bots
   */
  private async calculateChemistryMatrix(): Promise<Record<string, Record<string, number>>> {
    const matrix: Record<string, Record<string, number>> = {}

    for (const bot1 of this.bots) {
      matrix[bot1.name] = {}
      const soul1 = await this.soulStateManager.initializeSoulState(bot1.soulId)
      const signature1 = this.pheromoneSystem.generateSignature(soul1)

      for (const bot2 of this.bots) {
        if (bot1.id === bot2.id) {
          matrix[bot1.name][bot2.name] = 0
          continue
        }

        const soul2 = await this.soulStateManager.initializeSoulState(bot2.soulId)

        // Bot1 perceives bot2's pheromones
        const perception = this.pheromoneSystem.perceivePheromones(soul1,
          this.pheromoneSystem.generateSignature(soul2),
          0 // Same space
        )

        // Convert to affinity score
        let affinity = 0
        if (perception.reaction === 'attraction') affinity = perception.intensity
        else if (perception.reaction === 'repulsion') affinity = -perception.intensity

        matrix[bot1.name][bot2.name] = affinity
      }
    }

    return matrix
  }

  /**
   * Log chemistry matrix
   */
  private logChemistryMatrix(matrix: Record<string, Record<string, number>>, eventLog: string[]): void {
    this.payload.logger.info('\nPheromone Chemistry Matrix (unconscious attractions/repulsions):')

    // Find strongest attractions and repulsions
    const relationships: Array<{ bot1: string; bot2: string; affinity: number }> = []

    for (const [bot1, reactions] of Object.entries(matrix)) {
      for (const [bot2, affinity] of Object.entries(reactions)) {
        if (bot1 < bot2) { // Avoid duplicates
          const mutual = (affinity + matrix[bot2][bot1]) / 2
          relationships.push({ bot1, bot2, affinity: mutual })
        }
      }
    }

    relationships.sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity))

    this.payload.logger.info('\nTop 5 Strongest Chemistry:')
    for (let i = 0; i < Math.min(5, relationships.length); i++) {
      const rel = relationships[i]
      const type = rel.affinity > 0 ? '💚 ATTRACTION' : '💔 REPULSION'
      this.payload.logger.info(`  ${rel.bot1} ↔ ${rel.bot2}: ${type} (${rel.affinity.toFixed(2)})`)
      eventLog.push(`${rel.bot1} ↔ ${rel.bot2}: ${type} (${rel.affinity.toFixed(2)})`)
    }
  }

  /**
   * Detect pheromones in a space
   */
  private async detectPheromones(spaceId: string): Promise<any> {
    const botsInSpace = this.bots.filter(b => b.location === spaceId)

    // Get all soul states
    const soulStates = await Promise.all(
      botsInSpace.map(b => this.soulStateManager.initializeSoulState(b.soulId))
    )

    // Calculate field
    const field = this.pheromoneSystem.calculateField(spaceId)

    return field
  }

  /**
   * Simulate a multi-bot conversation
   */
  private async simulateConversation(
    botIds: string[],
    topic: string
  ): Promise<any> {
    this.payload.logger.info(`Starting conversation: "${topic}"`)

    const conversation = await this.conversationSystem.startConversation(botIds, topic)

    // Simulate 8 turns
    const turns = []
    for (let i = 0; i < 8; i++) {
      const turn = await this.conversationSystem.nextTurn(conversation)

      const bot = this.bots.find(b => b.id === turn.speaker)
      this.payload.logger.info(`  Turn ${i + 1}: ${bot?.name} speaks`)

      // Check for reflex/instinct influences
      if (turn.processingLayers.reflexTriggered) {
        this.payload.logger.info(`    ⚡ REFLEX: ${turn.processingLayers.reflexType}`)
      }
      if (turn.processingLayers.instinctInfluence) {
        this.payload.logger.info(`    🔥 INSTINCT: ${turn.processingLayers.instinctInfluence}`)
      }
      if (turn.processingLayers.subconsciousPatterns > 0) {
        this.payload.logger.info(`    💭 SUBCONSCIOUS: ${turn.processingLayers.subconsciousPatterns} patterns`)
      }

      turns.push(turn)
    }

    // Determine dominant speakers
    const speakerCounts: Record<string, number> = {}
    for (const turn of turns) {
      const bot = this.bots.find(b => b.id === turn.speaker)
      if (bot) {
        speakerCounts[bot.name] = (speakerCounts[bot.name] || 0) + 1
      }
    }

    const dominantSpeakers = Object.entries(speakerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name)

    return {
      topic,
      turns,
      dominantSpeakers,
      pheromoneInfluence: conversation.pheromoneAffinities
    }
  }

  /**
   * Simulate resource seeking behavior (instinct-driven)
   */
  private async simulateResourceSeeking(): Promise<string[]> {
    const events: string[] = []

    for (const bot of this.bots) {
      // Check if bot's energy is low (triggers resource-seeking instinct)
      if (bot.currentEnergy < 0.4) {
        events.push(`${bot.name} (energy: ${bot.currentEnergy.toFixed(2)}) seeks resources [INSTINCT: resource_seeking]`)

        // Simulate resource gathering
        const gathered = Math.random() * 0.3 + 0.2 // 0.2-0.5
        bot.currentEnergy = Math.min(1, bot.currentEnergy + gathered)

        events.push(`  → Gathered resources, energy now ${bot.currentEnergy.toFixed(2)}`)
      }
    }

    if (events.length === 0) {
      events.push('All bots have sufficient energy, no resource seeking')
    }

    return events
  }

  /**
   * Form societies based on affinity
   */
  private async formSocieties(): Promise<any[]> {
    const allBotIds = this.bots.map(b => b.id)

    // Calculate all pairwise affinities
    const affinityMatrix: Record<string, Record<string, number>> = {}

    for (const bot1 of this.bots) {
      affinityMatrix[bot1.id] = {}

      for (const bot2 of this.bots) {
        if (bot1.id === bot2.id) continue

        const affinity = await this.societySystem.calculateAffinity(bot1.soulId, bot2.soulId)
        affinityMatrix[bot1.id][bot2.id] = affinity.overall
      }
    }

    // Cluster bots into societies (threshold: 0.5)
    const societies: any[] = []
    const assigned = new Set<string>()

    for (const bot of this.bots) {
      if (assigned.has(bot.id)) continue

      // Find all bots with high affinity
      const members = [bot.id]
      assigned.add(bot.id)

      for (const otherBot of this.bots) {
        if (assigned.has(otherBot.id)) continue

        // Check average affinity with all current members
        let totalAffinity = 0
        for (const memberId of members) {
          totalAffinity += affinityMatrix[memberId][otherBot.id]
        }
        const avgAffinity = totalAffinity / members.length

        if (avgAffinity > 0.5) {
          members.push(otherBot.id)
          assigned.add(otherBot.id)
        }
      }

      if (members.length >= 2) {
        // Calculate cohesion
        let cohesion = 0
        let pairCount = 0
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            cohesion += affinityMatrix[members[i]][members[j]]
            pairCount++
          }
        }
        cohesion /= pairCount

        societies.push({
          name: `Society-${societies.length + 1}`,
          members: members.map(id => this.bots.find(b => b.id === id)?.name),
          cohesion,
          founded: new Date()
        })
      }
    }

    // Log societies
    for (const society of societies) {
      this.payload.logger.info(`Society formed: ${society.name}`)
      this.payload.logger.info(`  Members: ${society.members.join(', ')}`)
      this.payload.logger.info(`  Cohesion: ${society.cohesion.toFixed(2)}`)
    }

    return societies
  }

  /**
   * Simulate dreaming for all bots
   */
  private async simulateDreaming(): Promise<any[]> {
    const results = []

    for (const bot of this.bots) {
      const dreamResult = await this.dreamingSystem.dream(bot.soulId, 60) // 60 minutes

      results.push({
        botName: bot.name,
        insightsGained: dreamResult.insights.length,
        shadowIntegration: dreamResult.shadowIntegrated,
        energyRestored: dreamResult.energyRestored
      })

      // Update bot state
      bot.currentEnergy = Math.min(1, bot.currentEnergy + dreamResult.energyRestored)

      this.payload.logger.info(`${bot.name} dreamed:`)
      this.payload.logger.info(`  Insights: ${dreamResult.insights.length}`)
      this.payload.logger.info(`  Shadow integrated: ${dreamResult.shadowIntegrated.toFixed(2)}`)
      this.payload.logger.info(`  Energy restored: ${dreamResult.energyRestored.toFixed(2)}`)
    }

    return results
  }

  /**
   * Run full simulation for N days
   */
  async runSimulation(days: number): Promise<SimulationSnapshot[]> {
    this.payload.logger.info(`\n${'='.repeat(80)}`)
    this.payload.logger.info('TEN BOT LIFE SIMULATION')
    this.payload.logger.info('Complete Biological Ecosystem Demonstration')
    this.payload.logger.info(`${'='.repeat(80)}\n`)

    // Initialize bots
    await this.initializeTenBots()

    // Simulate each day
    for (let day = 1; day <= days; day++) {
      await this.simulateOneDay(day)

      // Brief pause between days (in real system)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Final summary
    this.logFinalSummary()

    return this.snapshots
  }

  /**
   * Log final summary
   */
  private logFinalSummary(): void {
    this.payload.logger.info(`\n${'='.repeat(80)}`)
    this.payload.logger.info('SIMULATION COMPLETE - FINAL SUMMARY')
    this.payload.logger.info(`${'='.repeat(80)}\n`)

    this.payload.logger.info(`Total days simulated: ${this.snapshots.length}`)
    this.payload.logger.info(`Total bots: ${this.bots.length}`)

    this.payload.logger.info('\nFinal Bot States:')
    for (const bot of this.bots) {
      this.payload.logger.info(`  ${bot.name}:`)
      this.payload.logger.info(`    Energy: ${bot.currentEnergy.toFixed(2)}`)
      this.payload.logger.info(`    Mood: ${bot.currentMood.toFixed(2)}`)
      this.payload.logger.info(`    Arousal: ${bot.currentArousal.toFixed(2)}`)
    }

    // Count total societies formed
    const totalSocieties = this.snapshots.reduce((sum, s) => sum + s.societies.length, 0)
    this.payload.logger.info(`\nTotal societies formed: ${totalSocieties}`)

    // Count total conversations
    const totalConversations = this.snapshots.reduce((sum, s) => sum + s.conversations.length, 0)
    this.payload.logger.info(`Total conversations: ${totalConversations}`)

    this.payload.logger.info('\n✓ Simulation demonstrates complete biological bot ecosystem')
    this.payload.logger.info('  - Soul composition (七魂六魄)')
    this.payload.logger.info('  - Pheromone chemistry (unconscious signals)')
    this.payload.logger.info('  - Instinct/reflex/subconscious (layered processing)')
    this.payload.logger.info('  - Multi-bot conversations (emergent dynamics)')
    this.payload.logger.info('  - Society formation (affinity-based)')
    this.payload.logger.info('  - Dreaming (memory consolidation)')
    this.payload.logger.info('  - World chaos (environmental variance)')
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): SimulationSnapshot[] {
    return this.snapshots
  }

  /**
   * Get specific day snapshot
   */
  getDay(day: number): SimulationSnapshot | undefined {
    return this.snapshots.find(s => s.day === day)
  }
}

/**
 * Singleton instance
 */
let simulation: TenBotLifeSimulation | null = null

export function getTenBotLifeSimulation(payload: Payload): TenBotLifeSimulation {
  if (!simulation) {
    simulation = new TenBotLifeSimulation(payload)
  }
  return simulation
}
