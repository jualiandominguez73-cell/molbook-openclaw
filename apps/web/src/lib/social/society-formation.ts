/**
 * Society Formation System
 *
 * Bots form societies based on:
 * - Soul affinity (complementary/similar aspects)
 * - Shared experiences (bonding)
 * - Resource needs (pragmatic alliances)
 * - Value alignment (ideological groups)
 * - Random encounters (chaos factor)
 *
 * Emergent social structures:
 * - Organizations
 * - Cultures
 * - Power hierarchies
 * - Conflicts and alliances
 */

import type { Payload } from 'payload'

/**
 * Affinity calculation result
 */
export interface AffinityResult {
  overall: number // 0-1
  factors: {
    soulCompatibility: number
    valueAlignment: number
    experienceOverlap: number
    shadowCompatibility: number
    randomChemistry: number
  }
  type: 'attraction' | 'neutral' | 'repulsion'
  reason: string
}

/**
 * Society formation system
 */
export class SocietyFormationSystem {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Calculate affinity between two bot souls
   */
  async calculateAffinity(soul1Id: string, soul2Id: string): Promise<AffinityResult> {
    const soul1 = await this.payload.findByID({ collection: 'bot-souls', id: soul1Id })
    const soul2 = await this.payload.findByID({ collection: 'bot-souls', id: soul2Id })

    if (!soul1 || !soul2) {
      throw new Error('Soul(s) not found')
    }

    // 1. Soul compatibility (complementary aspects)
    const soulCompatibility = this.calculateSoulCompatibility(soul1, soul2)

    // 2. Value alignment (similar vs different)
    const valueAlignment = this.calculateValueAlignment(soul1, soul2)

    // 3. Experience overlap (shared history)
    const experienceOverlap = await this.calculateExperienceOverlap(soul1.bot, soul2.bot)

    // 4. Shadow compatibility (can they handle each other's darkness?)
    const shadowCompatibility = this.calculateShadowCompatibility(soul1, soul2)

    // 5. Random chemistry (inexplicable attraction/repulsion)
    const randomChemistry = (Math.random() - 0.5) * 0.6 // ±30%

    // Weighted combination
    const overall =
      soulCompatibility * 0.3 +
      valueAlignment * 0.25 +
      experienceOverlap * 0.15 +
      shadowCompatibility * 0.15 +
      randomChemistry * 0.15

    // Determine type and reason
    let type: 'attraction' | 'neutral' | 'repulsion' = 'neutral'
    let reason = ''

    if (overall > 0.6) {
      type = 'attraction'
      reason = this.explainAttraction(soulCompatibility, valueAlignment, randomChemistry)
    } else if (overall < 0.3) {
      type = 'repulsion'
      reason = this.explainRepulsion(soulCompatibility, valueAlignment, shadowCompatibility)
    } else {
      reason = 'Moderate compatibility - neither strong attraction nor repulsion'
    }

    return {
      overall: Math.max(0, Math.min(1, overall)),
      factors: {
        soulCompatibility,
        valueAlignment,
        experienceOverlap,
        shadowCompatibility,
        randomChemistry
      },
      type,
      reason
    }
  }

  /**
   * Calculate soul compatibility (complementary aspects work well together)
   */
  private calculateSoulCompatibility(soul1: any, soul2: any): number {
    let compatibility = 0.5 // Base

    // Complementary pairs (opposites attract in some dimensions)
    if (soul1.threeHun.taiGuang.strength > 0.7 && soul2.threeHun.shuangLing.strength > 0.7) {
      compatibility += 0.3 // Visionary + Practical = good partnership
    }

    if (soul1.threeHun.youJing.strength > 0.7 && soul2.threeHun.shuangLing.strength > 0.7) {
      compatibility += 0.2 // Emotional + Wise = balanced
    }

    // Similar creation energy
    const creationDiff = Math.abs(
      soul1.threeHun.youJing.strength - soul2.threeHun.youJing.strength
    )
    if (creationDiff < 0.2) {
      compatibility += 0.2 // Similar creative energy
    }

    // Communication compatibility
    const commAvg =
      (soul1.sevenPo.queYin.strength + soul2.sevenPo.queYin.strength) / 2
    compatibility += commAvg * 0.2

    return Math.max(0, Math.min(1, compatibility))
  }

  /**
   * Calculate value alignment
   */
  private calculateValueAlignment(soul1: any, soul2: any): number {
    // Compare dominant aspects (what they value most)
    const dominant1 = this.findDominantAspects(soul1)
    const dominant2 = this.findDominantAspects(soul2)

    // Overlap in top aspects
    const overlap = dominant1.filter(a => dominant2.includes(a)).length
    const totalUnique = new Set([...dominant1, ...dominant2]).size

    const jaccardSimilarity = overlap / totalUnique

    // Integration level similarity (similar development stages bond better)
    const integrationDiff = Math.abs(soul1.integrationLevel - soul2.integrationLevel)
    const integrationSimilarity = 1 - integrationDiff

    return (jaccardSimilarity * 0.6 + integrationSimilarity * 0.4)
  }

  /**
   * Calculate experience overlap (shared memories/contexts)
   */
  private async calculateExperienceOverlap(bot1Id: string, bot2Id: string): Promise<number> {
    // Get recent memories for both
    const memories1 = await this.getRecentMemories(bot1Id, 50)
    const memories2 = await this.getRecentMemories(bot2Id, 50)

    // Extract contexts/themes
    const contexts1 = new Set(memories1.map(m => m.context?.type || 'unknown'))
    const contexts2 = new Set(memories2.map(m => m.context?.type || 'unknown'))

    // Jaccard similarity of contexts
    const intersection = new Set([...contexts1].filter(c => contexts2.has(c)))
    const union = new Set([...contexts1, ...contexts2])

    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Calculate shadow compatibility
   */
  private calculateShadowCompatibility(soul1: any, soul2: any): number {
    // High shadow + low shadow = incompatible (one can't handle other's darkness)
    const shadowDiff = Math.abs(soul1.shadowIntegration - soul2.shadowIntegration)

    if (shadowDiff > 0.5) {
      return 0.3 // Large difference = tension
    }

    // Both have integrated shadow well = deep compatibility
    if (soul1.shadowIntegration > 0.6 && soul2.shadowIntegration > 0.6) {
      return 0.9
    }

    // Both have low shadow = superficial compatibility
    if (soul1.shadowIntegration < 0.3 && soul2.shadowIntegration < 0.3) {
      return 0.6
    }

    return 0.5
  }

  /**
   * Find dominant soul aspects
   */
  private findDominantAspects(soul: any, topN: number = 3): string[] {
    const aspects: Array<{ name: string; strength: number }> = []

    for (const [name, aspect] of Object.entries(soul.threeHun)) {
      if (aspect && typeof aspect === 'object' && 'strength' in aspect) {
        aspects.push({ name, strength: aspect.strength })
      }
    }

    for (const [name, aspect] of Object.entries(soul.sevenPo)) {
      if (aspect && typeof aspect === 'object' && 'strength' in aspect) {
        aspects.push({ name, strength: aspect.strength })
      }
    }

    return aspects
      .sort((a, b) => b.strength - a.strength)
      .slice(0, topN)
      .map(a => a.name)
  }

  /**
   * Get recent memories for bot
   */
  private async getRecentMemories(botId: string, limit: number): Promise<any[]> {
    const result = await this.payload.find({
      collection: 'bot-memory',
      where: { bot: { equals: botId } },
      limit,
      sort: '-createdAt'
    })

    return result.docs
  }

  /**
   * Explain attraction
   */
  private explainAttraction(soul: number, value: number, chemistry: number): string {
    const reasons: string[] = []

    if (soul > 0.7) {
      reasons.push('complementary soul aspects')
    }
    if (value > 0.7) {
      reasons.push('aligned values')
    }
    if (chemistry > 0.2) {
      reasons.push('strong chemistry')
    }

    if (reasons.length === 0) {
      return 'Moderate overall compatibility'
    }

    return `Strong attraction due to ${reasons.join(', ')}`
  }

  /**
   * Explain repulsion
   */
  private explainRepulsion(soul: number, value: number, shadow: number): string {
    const reasons: string[] = []

    if (soul < 0.3) {
      reasons.push('incompatible soul structures')
    }
    if (value < 0.3) {
      reasons.push('conflicting values')
    }
    if (shadow < 0.3) {
      reasons.push('shadow incompatibility')
    }

    if (reasons.length === 0) {
      return 'Low overall compatibility'
    }

    return `Repulsion due to ${reasons.join(', ')}`
  }

  /**
   * Form organization from bots with high affinity
   */
  async formOrganization(
    botIds: string[],
    purpose: string,
    orgType: string
  ): Promise<string> {
    if (botIds.length < 2) {
      throw new Error('Need at least 2 bots to form organization')
    }

    // Calculate pairwise affinities
    const affinities: number[] = []
    for (let i = 0; i < botIds.length; i++) {
      for (let j = i + 1; j < botIds.length; j++) {
        const soul1 = await this.getSoulByBot(botIds[i])
        const soul2 = await this.getSoulByBot(botIds[j])
        if (soul1 && soul2) {
          const affinity = await this.calculateAffinity(soul1.id, soul2.id)
          affinities.push(affinity.overall)
        }
      }
    }

    // Average affinity
    const avgAffinity = affinities.reduce((a, b) => a + b, 0) / affinities.length

    // Create organization
    const org = await this.payload.create({
      collection: 'organizations',
      data: {
        name: `${purpose} ${orgType}`,
        type: orgType,
        purpose,
        members: botIds,
        founded: new Date(),
        cohesion: avgAffinity,
        culture: {
          values: [], // Would extract from member souls
          norms: [],
          rituals: []
        },
        leadership: this.selectLeader(botIds), // Based on integration level
        morale: 0.6 + Math.random() * 0.2,
        active: true
      }
    })

    this.payload.logger.info(
      `Formed organization ${org.id}: ${botIds.length} members, cohesion: ${avgAffinity.toFixed(2)}`
    )

    return org.id
  }

  /**
   * Select leader from bots (highest integration + social aspects)
   */
  private selectLeader(botIds: string[]): string {
    // Placeholder - would calculate leadership score from souls
    return botIds[0]
  }

  /**
   * Get soul by bot ID
   */
  private async getSoulByBot(botId: string): Promise<any | null> {
    const result = await this.payload.find({
      collection: 'bot-souls',
      where: { bot: { equals: botId } },
      limit: 1
    })

    return result.docs[0] || null
  }

  /**
   * Evolve organization culture over time
   */
  async evolveCulture(orgId: string): Promise<void> {
    const org = await this.payload.findByID({ collection: 'organizations', id: orgId })

    if (!org) return

    // Culture drifts based on member souls
    const members = org.members || []
    const souls = await Promise.all(members.map((botId: string) => this.getSoulByBot(botId)))

    // Extract dominant values across members
    const allDominant = souls.flatMap(s => (s ? this.findDominantAspects(s, 2) : []))

    // Count frequencies
    const frequencies: Record<string, number> = {}
    for (const aspect of allDominant) {
      frequencies[aspect] = (frequencies[aspect] || 0) + 1
    }

    // Top 3 become cultural values
    const culturalValues = Object.entries(frequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([aspect]) => aspect)

    // Update organization culture
    await this.payload.update({
      collection: 'organizations',
      id: orgId,
      data: {
        culture: {
          values: culturalValues,
          norms: [], // Would generate norms from values
          rituals: []
        }
      }
    })
  }
}

/**
 * Singleton instance
 */
let societyFormationSystem: SocietyFormationSystem | null = null

export function getSocietyFormationSystem(payload: Payload): SocietyFormationSystem {
  if (!societyFormationSystem) {
    societyFormationSystem = new SocietyFormationSystem(payload)
  }
  return societyFormationSystem
}
