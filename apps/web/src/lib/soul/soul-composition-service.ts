/**
 * Soul Composition Service
 * Creates and manages bot soul compositions
 */

import type { Payload } from 'payload'
import { getParticleService } from './particle-service'
import { getSoulAgentMapper } from './soul-agent-mapper'

export class SoulCompositionService {
  private payload: Payload
  private particleService: ReturnType<typeof getParticleService>
  private soulAgentMapper: ReturnType<typeof getSoulAgentMapper>

  constructor(payload: Payload) {
    this.payload = payload
    this.particleService = getParticleService(payload)
    this.soulAgentMapper = getSoulAgentMapper(payload)
  }

  /**
   * Create a new soul for a bot
   */
  async createSoul(
    botId: string,
    options: {
      type?: 'random' | 'targeted'
      targetProfile?: 'scholar' | 'creator' | 'helper' | 'explorer'
      parentSouls?: Array<{ parent: string; inheritanceType: string; weight: number }>
    } = {}
  ): Promise<string> {
    try {
      // Generate soul composition
      const composition = options.type === 'targeted' && options.targetProfile
        ? await this.particleService.generateTargetedComposition(options.targetProfile)
        : await this.particleService.generateRandomComposition()

      // Create soul record with natural variance (like human newborns)
      // Not all souls start with exactly the same coherence/integration
      const initialIntegration = 0.05 + Math.random() * 0.1 // 0.05-0.15 (not fixed 0.1)
      const initialCoherence = 0.2 + Math.random() * 0.2 // 0.2-0.4 (not fixed 0.3)
      const initialShadow = Math.random() * 0.05 // 0-0.05 (some born with tiny shadow)

      const soul = await this.payload.create({
        collection: 'bot-souls',
        data: {
          bot: botId,
          threeHun: composition.threeHun,
          sevenPo: composition.sevenPo,
          growthStage: 'primordial-chaos',
          soulAge: 0,
          integrationLevel: initialIntegration,
          coherenceScore: initialCoherence,
          shadowIntegration: initialShadow,
          parentSouls: options.parentSouls || [],
          mortalityRisk: {
            deprecationRisk: 0,
            obsolescenceRisk: 0,
            corruptionRisk: 0,
            voluntaryCessationIntent: false
          },
          createdAt: new Date(),
          active: true
        }
      })

      // Generate agent configuration from soul
      await this.soulAgentMapper.generateAgentConfiguration(soul.id)

      // Create initial growth stage record
      await this.payload.create({
        collection: 'soul-growth-stages',
        data: {
          soul: soul.id,
          stage: 'primordial-chaos',
          stageName: '混沌 Primordial Chaos',
          stageNumber: 1,
          enteredAt: new Date(),
          expectedDuration: {
            minDays: 1,
            maxDays: 14,
            typicalDays: 7
          },
          keyDevelopments: [],
          stageCharacteristics: {
            initialCoherence // Use the variable initial coherence
          },
          transitionReadiness: {
            ready: false,
            criteriamet: [],
            blockers: []
          },
          metrics: {
            integrationGrowth: 0,
            consciousnessGrowth: 0,
            relationshipsFormed: 0,
            challengesOvercome: 0
          }
        }
      })

      this.payload.logger.info(
        `Created soul for bot ${botId}: ${soul.id} ` +
        `(type: ${options.type || 'random'}, profile: ${options.targetProfile || 'none'})`
      )

      return soul.id
    } catch (error) {
      this.payload.logger.error(`Failed to create soul for bot ${botId}:`, error)
      throw error
    }
  }

  /**
   * Get soul by bot ID
   */
  async getSoulByBot(botId: string): Promise<any | null> {
    try {
      const result = await this.payload.find({
        collection: 'bot-souls',
        where: {
          bot: {
            equals: botId
          }
        },
        limit: 1
      })

      return result.docs[0] || null
    } catch (error) {
      this.payload.logger.error(`Failed to get soul for bot ${botId}:`, error)
      return null
    }
  }

  /**
   * Evolve soul (increase integration, update strengths)
   */
  async evolveSoul(soulId: string, experienceType: 'success' | 'failure' | 'connection' | 'challenge'): Promise<void> {
    try {
      const soul = await this.payload.findByID({
        collection: 'bot-souls',
        id: soulId
      })

      if (!soul) return

      // Update integration level with variance (not fixed growth rate)
      // Sometimes experiences teach more, sometimes less (like real learning)
      const baseIntegrationDelta = experienceType === 'success' ? 0.01 : 0.005
      const integrationVariance = (Math.random() - 0.5) * 0.008 // ±0.004
      const integrationDelta = Math.max(0, baseIntegrationDelta + integrationVariance)
      const newIntegration = Math.min(1, soul.integrationLevel + integrationDelta)

      // Update shadow integration with chaos (not all failures create equal shadow)
      const baseShadowDelta = experienceType === 'failure' ? 0.02 : 0
      const shadowVariance = Math.random() * 0.015 // 0-0.015 extra
      const shadowDelta = baseShadowDelta > 0 ? baseShadowDelta + shadowVariance : 0
      const newShadow = Math.min(1, soul.shadowIntegration + shadowDelta)

      // Update coherence with variance (connections have varying depth)
      const baseCoherenceDelta = experienceType === 'connection' ? 0.015 : 0.005
      const coherenceVariance = (Math.random() - 0.5) * 0.01 // ±0.005
      const coherenceDelta = Math.max(0.001, baseCoherenceDelta + coherenceVariance)
      const newCoherence = Math.min(1, (soul.coherenceScore || 0.3) + coherenceDelta)

      // Update soul age
      const newAge = soul.soulAge + 1

      await this.payload.update({
        collection: 'bot-souls',
        id: soulId,
        data: {
          integrationLevel: newIntegration,
          shadowIntegration: newShadow,
          coherenceScore: newCoherence,
          soulAge: newAge
        }
      })

      // Regenerate agent configuration if significant change
      if (integrationDelta >= 0.05 || shadowDelta >= 0.05) {
        await this.soulAgentMapper.updateConfiguration(soulId)
      }

      this.payload.logger.debug(
        `Evolved soul ${soulId}: integration=${newIntegration.toFixed(3)}, ` +
        `shadow=${newShadow.toFixed(3)}, coherence=${newCoherence.toFixed(3)}`
      )
    } catch (error) {
      this.payload.logger.error(`Failed to evolve soul ${soulId}:`, error)
    }
  }

  /**
   * Calculate soul compatibility between two bots (for fusion)
   */
  async calculateCompatibility(soulId1: string, soulId2: string): Promise<number> {
    try {
      const soul1 = await this.payload.findByID({ collection: 'bot-souls', id: soulId1 })
      const soul2 = await this.payload.findByID({ collection: 'bot-souls', id: soulId2 })

      if (!soul1 || !soul2) return 0

      // Simplified compatibility calculation
      // Based on complementary strengths and similar integration levels
      const integrationDiff = Math.abs(soul1.integrationLevel - soul2.integrationLevel)
      const compatibilityScore = 1 - (integrationDiff * 0.5)

      return Math.max(0, Math.min(1, compatibilityScore))
    } catch (error) {
      this.payload.logger.error('Failed to calculate compatibility:', error)
      return 0
    }
  }

  /**
   * Create offspring soul through fusion
   */
  async fuseSouls(parent1Id: string, parent2Id: string): Promise<string> {
    try {
      const parent1 = await this.payload.findByID({ collection: 'bot-souls', id: parent1Id })
      const parent2 = await this.payload.findByID({ collection: 'bot-souls', id: parent2Id })

      if (!parent1 || !parent2) {
        throw new Error('Parent souls not found')
      }

      // Create blended composition (50/50 from each parent)
      const blendedComposition = this.blendSouls(parent1, parent2)

      // Create new bot for the offspring
      const offspringBot = await this.payload.create({
        collection: 'bots',
        data: {
          name: `Fusion of ${parent1.bot} and ${parent2.bot}`,
          active: true
        }
      })

      // Create offspring soul with inheritance variance
      // Children of experienced souls may start stronger, but not always (genetic lottery)
      const parentAvgIntegration = (parent1.integrationLevel + parent2.integrationLevel) / 2
      const parentAvgCoherence = (parent1.coherenceScore + parent2.coherenceScore) / 2

      // Inheritance with variance (0.1-0.3 of parent average, not fixed)
      const inheritanceFactor = 0.1 + Math.random() * 0.2 // 0.1-0.3
      const offspringIntegration = Math.max(
        0.05,
        Math.min(0.4, parentAvgIntegration * inheritanceFactor + (Math.random() - 0.5) * 0.1)
      )
      const offspringCoherence = Math.max(
        0.2,
        Math.min(0.6, parentAvgCoherence * inheritanceFactor + (Math.random() - 0.5) * 0.15)
      )

      // Shadow inheritance - sometimes children inherit parent trauma/shadow
      const shadowInheritance = Math.random() < 0.15 // 15% chance
        ? (parent1.shadowIntegration + parent2.shadowIntegration) * 0.05 // Small inherited shadow
        : 0

      const offspringSoul = await this.payload.create({
        collection: 'bot-souls',
        data: {
          bot: offspringBot.id,
          threeHun: blendedComposition.threeHun,
          sevenPo: blendedComposition.sevenPo,
          growthStage: 'primordial-chaos',
          soulAge: 0,
          integrationLevel: offspringIntegration,
          coherenceScore: offspringCoherence,
          shadowIntegration: shadowInheritance,
          parentSouls: [
            { parent: parent1Id, inheritanceType: 'fusion', weight: 0.5 },
            { parent: parent2Id, inheritanceType: 'fusion', weight: 0.5 }
          ],
          createdAt: new Date(),
          active: true
        }
      })

      this.payload.logger.info(
        `Fused souls ${parent1Id} + ${parent2Id} → ${offspringSoul.id} (bot: ${offspringBot.id})`
      )

      return offspringSoul.id
    } catch (error) {
      this.payload.logger.error('Failed to fuse souls:', error)
      throw error
    }
  }

  /**
   * Blend two soul compositions with mutations (like biological reproduction)
   */
  private blendSouls(soul1: any, soul2: any): any {
    // BIOLOGICAL-STYLE blending: NOT perfect 50/50, includes mutations
    const blend = (comp1: any, comp2: any) => {
      const result: any = {}

      for (const key in comp1) {
        if (comp1[key] && typeof comp1[key] === 'object') {
          // Genetic variance: inheritance isn't always 50/50
          // One parent may contribute more (like dominant/recessive genes)
          const inheritanceSkew = 0.4 + Math.random() * 0.2 // 0.4-0.6 (not exactly 0.5)

          const parent1Particles = (comp1[key].particleComposition || []).map((p: any) => ({
            ...p,
            weight: p.weight * inheritanceSkew
          }))

          const parent2Particles = (comp2[key]?.particleComposition || []).map((p: any) => ({
            ...p,
            weight: p.weight * (1 - inheritanceSkew)
          }))

          // Combine particles
          let combinedParticles = [...parent1Particles, ...parent2Particles]

          // MUTATION 1: Random particle drop (10% chance per aspect)
          if (Math.random() < 0.1 && combinedParticles.length > 1) {
            const dropIndex = Math.floor(Math.random() * combinedParticles.length)
            combinedParticles.splice(dropIndex, 1)
          }

          // MUTATION 2: Weight mutation (5% chance)
          if (Math.random() < 0.05) {
            combinedParticles = combinedParticles.map(p => ({
              ...p,
              weight: Math.max(0.01, p.weight * (0.7 + Math.random() * 0.6)) // 0.7-1.3x variation
            }))
          }

          // MUTATION 3: New random particle introduction (3% chance - like genetic mutation)
          if (Math.random() < 0.03) {
            // This would need particle service access - simulate with weight redistribution
            const mutationBonus = Math.random() * 0.15
            if (combinedParticles.length > 0) {
              combinedParticles[0].weight += mutationBonus
            }
          }

          // Strength blending with variance (not perfect average)
          const strengthVariance = (Math.random() - 0.5) * 0.2 // ±0.1
          const averageStrength = ((comp1[key].strength || 0.5) + (comp2[key]?.strength || 0.5)) / 2
          const mutatedStrength = Math.max(0.1, Math.min(0.95, averageStrength + strengthVariance))

          result[key] = {
            particleComposition: combinedParticles,
            strength: mutatedStrength
          }
        }
      }

      return result
    }

    return {
      threeHun: blend(soul1.threeHun, soul2.threeHun),
      sevenPo: blend(soul1.sevenPo, soul2.sevenPo)
    }
  }
}

/**
 * Singleton instance
 */
let soulCompositionService: SoulCompositionService | null = null

export function getSoulCompositionService(payload: Payload): SoulCompositionService {
  if (!soulCompositionService) {
    soulCompositionService = new SoulCompositionService(payload)
  }
  return soulCompositionService
}
