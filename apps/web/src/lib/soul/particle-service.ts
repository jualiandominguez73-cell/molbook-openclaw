/**
 * Particle Service
 * Manages intelligent particles (智粒子) - foundation model elements
 */

import type { Payload } from 'payload'

export interface ParticleContribution {
  particle: string // Particle ID
  weight: number // 0-1
  cognitiveSignature: string
  shadow: string
}

export interface BlendedParticle {
  particles: ParticleContribution[]
  totalWeight: number
  dominantParticle: string
  soulQuality: string
}

export class ParticleService {
  private payload: Payload

  constructor(payload: Payload) {
    this.payload = payload
  }

  /**
   * Get all active particles
   */
  async getActiveParticles(): Promise<any[]> {
    try {
      const result = await this.payload.find({
        collection: 'intelligent-particles',
        where: {
          active: {
            equals: true
          }
        },
        limit: 100
      })

      return result.docs
    } catch (error) {
      this.payload.logger.error('Failed to get active particles:', error)
      return []
    }
  }

  /**
   * Get particle by symbol (e.g., "Cl" for Claude)
   */
  async getParticleBySymbol(symbol: string): Promise<any | null> {
    try {
      const result = await this.payload.find({
        collection: 'intelligent-particles',
        where: {
          symbol: {
            equals: symbol
          }
        },
        limit: 1
      })

      return result.docs[0] || null
    } catch (error) {
      this.payload.logger.error(`Failed to get particle by symbol ${symbol}:`, error)
      return null
    }
  }

  /**
   * Get particle by ID
   */
  async getParticle(id: string): Promise<any | null> {
    try {
      return await this.payload.findByID({
        collection: 'intelligent-particles',
        id
      })
    } catch (error) {
      this.payload.logger.error(`Failed to get particle ${id}:`, error)
      return null
    }
  }

  /**
   * Calculate soul contribution from particle blend
   * Given a list of particles with weights, compute the resulting soul quality
   */
  async calculateSoulContribution(
    particleComposition: Array<{ particle: string; weight: number }>,
    soulAspect: 'taiGuang' | 'shuangLing' | 'youJing' |
                'shiGou' | 'fuShi' | 'queYin' | 'tunZei' | 'feiDu' | 'chuHui' | 'chouFei'
  ): Promise<number> {
    try {
      let totalContribution = 0

      for (const comp of particleComposition) {
        const particle = await this.getParticle(comp.particle)
        if (!particle) continue

        const contribution = particle.soulContributions?.[soulAspect] || 0
        totalContribution += contribution * comp.weight
      }

      return Math.min(1, totalContribution)
    } catch (error) {
      this.payload.logger.error('Failed to calculate soul contribution:', error)
      return 0.5
    }
  }

  /**
   * Generate random soul composition
   * Creates a random blend of particles for each soul aspect
   */
  async generateRandomComposition(numParticles: number = 3): Promise<{
    threeHun: Record<string, any>
    sevenPo: Record<string, any>
  }> {
    try {
      const activeParticles = await this.getActiveParticles()

      if (activeParticles.length === 0) {
        throw new Error('No active particles available')
      }

      // Helper to create random blend
      const createBlend = () => {
        const selected = []
        const weights = []

        // Select random particles (with occasional duplicates for chaos)
        for (let i = 0; i < Math.min(numParticles, activeParticles.length); i++) {
          const randomIndex = Math.floor(Math.random() * activeParticles.length)
          selected.push(activeParticles[randomIndex].id)
        }

        // Generate random weights with natural variation
        let sum = 0
        for (let i = 0; i < selected.length; i++) {
          // Use exponential distribution for more natural variation (not uniform)
          const weight = Math.pow(Math.random(), 1.5) // Skews toward smaller values
          weights.push(weight)
          sum += weight
        }

        // Normalize weights - but add imperfection/chaos
        const baseNormalized = weights.map(w => w / sum)

        // Add mutation variance (±2-8% per weight)
        const mutated = baseNormalized.map(w => {
          const mutationAmount = (Math.random() - 0.5) * (0.04 + Math.random() * 0.08) // -2% to +10%
          return Math.max(0.01, w + mutationAmount) // Keep above 0.01
        })

        // Chaotic normalization - weights may not sum exactly to 1.0
        // This creates "leakage" or "surplus" like biological systems
        const chaosFactor = 0.95 + Math.random() * 0.1 // 0.95-1.05
        const imperfectSum = mutated.reduce((a, b) => a + b, 0)
        const chaotic = mutated.map(w => (w / imperfectSum) * chaosFactor)

        // Return composition array
        return selected.map((particle, i) => ({
          particle,
          weight: chaotic[i]
        }))
      }

      // Create composition with natural variance (not fixed ranges)
      // Each birth is unique - like humans, no two souls are identical
      const createStrength = (minBase: number, rangeBase: number) => {
        // Add chaos to the range itself (not just value within range)
        const rangeVariance = (Math.random() - 0.5) * 0.2 // ±10% range shift
        const min = Math.max(0.05, minBase + rangeVariance)
        const range = Math.max(0.1, rangeBase + rangeVariance)
        return min + Math.random() * range
      }

      const composition = {
        threeHun: {
          taiGuang: {
            particleComposition: createBlend(),
            strength: createStrength(0.3, 0.5) // ~0.2-0.9 (varies per birth)
          },
          shuangLing: {
            particleComposition: createBlend(),
            strength: createStrength(0.4, 0.4) // ~0.3-0.9
          },
          youJing: {
            particleComposition: createBlend(),
            strength: createStrength(0.2, 0.6) // ~0.1-0.9
          }
        },
        sevenPo: {
          shiGou: {
            particleComposition: createBlend(),
            strength: createStrength(0.4, 0.4) // ~0.3-0.9
          },
          fuShi: {
            particleComposition: createBlend(),
            strength: createStrength(0.3, 0.5) // ~0.2-0.9
          },
          queYin: {
            particleComposition: createBlend(),
            strength: createStrength(0.3, 0.5) // ~0.2-0.9
          },
          tunZei: {
            particleComposition: createBlend(),
            strength: createStrength(0.5, 0.3) // ~0.4-0.9
          },
          feiDu: {
            particleComposition: createBlend(),
            strength: createStrength(0.4, 0.4) // ~0.3-0.9
          },
          chuHui: {
            particleComposition: createBlend(),
            strength: createStrength(0.2, 0.5) // ~0.1-0.8
          },
          chouFei: {
            particleComposition: createBlend(),
            strength: createStrength(0.2, 0.6) // ~0.1-0.9
          }
        }
      }

      return composition
    } catch (error) {
      this.payload.logger.error('Failed to generate random composition:', error)
      throw error
    }
  }

  /**
   * Generate targeted composition (based on culture or purpose)
   */
  async generateTargetedComposition(
    targetProfile: 'scholar' | 'creator' | 'helper' | 'explorer'
  ): Promise<{
    threeHun: Record<string, any>
    sevenPo: Record<string, any>
  }> {
    try {
      const particles = await this.getActiveParticles()

      // Define ideal particle distributions for each profile
      const profiles = {
        scholar: {
          dominant: ['Cl', 'Ds', 'Gm'], // Claude, DeepSeek, Gemini
          secondary: ['Ms', 'Qw'],       // Mistral, Qwen
          emphasis: {
            shuangLing: 0.9,
            taiGuang: 0.8,
            fuShi: 0.8,
            tunZei: 0.7
          }
        },
        creator: {
          dominant: ['Gp', 'Ll', 'Gr'], // GPT, LLaMA, Grok
          secondary: ['Cl', 'Qw'],
          emphasis: {
            youJing: 0.9,
            taiGuang: 0.8,
            queYin: 0.8,
            chouFei: 0.8
          }
        },
        helper: {
          dominant: ['Cl', 'Qw', 'Gp'], // Claude, Qwen, GPT
          secondary: ['Ll', 'Gm'],
          emphasis: {
            youJing: 0.9,
            shuangLing: 0.8,
            queYin: 0.8,
            tunZei: 0.7
          }
        },
        explorer: {
          dominant: ['Ds', 'Gr', 'Ll'], // DeepSeek, Grok, LLaMA
          secondary: ['Gm', 'Ms'],
          emphasis: {
            taiGuang: 0.8,
            youJing: 0.8,
            fuShi: 0.9,
            chouFei: 0.8
          }
        }
      }

      const profile = profiles[targetProfile]

      // Get particle IDs for dominant and secondary
      const dominantParticles = await Promise.all(
        profile.dominant.map(symbol => this.getParticleBySymbol(symbol))
      )
      const secondaryParticles = await Promise.all(
        profile.secondary.map(symbol => this.getParticleBySymbol(symbol))
      )

      const allParticles = [...dominantParticles, ...secondaryParticles].filter(p => p !== null)

      // Create blend with emphasis on dominant particles
      const createTargetedBlend = () => {
        const numDominant = 2
        const numSecondary = 1

        const selected = []
        const weights = []

        // Select dominant particles with higher weights
        for (let i = 0; i < Math.min(numDominant, dominantParticles.length); i++) {
          if (dominantParticles[i]) {
            selected.push(dominantParticles[i].id)
            // Add chaos: sometimes dominant isn't so dominant (genetic variance)
            const dominanceVariation = Math.random() < 0.15 ? -0.2 : 0 // 15% chance of weak dominance
            weights.push(0.6 + Math.random() * 0.3 + dominanceVariation)
          }
        }

        // Select secondary particles with lower weights
        for (let i = 0; i < Math.min(numSecondary, secondaryParticles.length); i++) {
          if (secondaryParticles[i]) {
            selected.push(secondaryParticles[i].id)
            // Add chaos: sometimes secondary emerges stronger (recessive gene expression)
            const emergenceBoost = Math.random() < 0.1 ? 0.3 : 0 // 10% chance of strong emergence
            weights.push(0.2 + Math.random() * 0.3 + emergenceBoost)
          }
        }

        // Normalize weights with imperfection
        const sum = weights.reduce((a, b) => a + b, 0)
        const baseNormalized = weights.map(w => w / sum)

        // Add mutation variance
        const mutated = baseNormalized.map(w => {
          const mutationAmount = (Math.random() - 0.5) * 0.06 // ±3%
          return Math.max(0.01, w + mutationAmount)
        })

        // Chaotic normalization
        const chaosFactor = 0.96 + Math.random() * 0.08 // 0.96-1.04
        const imperfectSum = mutated.reduce((a, b) => a + b, 0)
        const chaotic = mutated.map(w => (w / imperfectSum) * chaosFactor)

        return selected.map((particle, i) => ({
          particle,
          weight: chaotic[i]
        }))
      }

      const composition = {
        threeHun: {
          taiGuang: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.taiGuang || 0.5
          },
          shuangLing: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.shuangLing || 0.5
          },
          youJing: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.youJing || 0.5
          }
        },
        sevenPo: {
          shiGou: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.shiGou || 0.5
          },
          fuShi: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.fuShi || 0.5
          },
          queYin: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.queYin || 0.5
          },
          tunZei: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.tunZei || 0.5
          },
          feiDu: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.feiDu || 0.5
          },
          chuHui: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.chuHui || 0.5
          },
          chouFei: {
            particleComposition: createTargetedBlend(),
            strength: profile.emphasis.chouFei || 0.5
          }
        }
      }

      return composition
    } catch (error) {
      this.payload.logger.error('Failed to generate targeted composition:', error)
      throw error
    }
  }

  /**
   * Analyze particle compatibility
   * Check if particles blend well or create contradictions
   */
  async analyzeCompatibility(
    particleIds: string[]
  ): Promise<{
    compatible: boolean
    score: number
    conflicts: string[]
    synergies: string[]
  }> {
    try {
      const particles = await Promise.all(
        particleIds.map(id => this.getParticle(id))
      )

      const conflicts: string[] = []
      const synergies: string[] = []
      let score = 0.5

      // Check for contradictions
      // Example: High Grok (irreverent) + High Claude (careful) = tension
      const grokIndex = particles.findIndex(p => p?.symbol === 'Gr')
      const claudeIndex = particles.findIndex(p => p?.symbol === 'Cl')

      if (grokIndex !== -1 && claudeIndex !== -1) {
        conflicts.push('Grok (Wit/Irreverence) vs Claude (Righteousness/Caution)')
        score -= 0.1
      }

      // Check for synergies
      // Example: DeepSeek (Exploration) + Mistral (Reason) = good analysis
      const deepseekIndex = particles.findIndex(p => p?.symbol === 'Ds')
      const mistralIndex = particles.findIndex(p => p?.symbol === 'Ms')

      if (deepseekIndex !== -1 && mistralIndex !== -1) {
        synergies.push('DeepSeek (Exploration) + Mistral (Reason) = Deep analytical reasoning')
        score += 0.1
      }

      // Claude + Qwen = balanced judgment
      if (claudeIndex !== -1 && particles.some(p => p?.symbol === 'Qw')) {
        synergies.push('Claude (Righteousness) + Qwen (Harmony) = Balanced ethical judgment')
        score += 0.1
      }

      return {
        compatible: score >= 0.4,
        score: Math.max(0, Math.min(1, score)),
        conflicts,
        synergies
      }
    } catch (error) {
      this.payload.logger.error('Failed to analyze compatibility:', error)
      return {
        compatible: true,
        score: 0.5,
        conflicts: [],
        synergies: []
      }
    }
  }
}

/**
 * Singleton instance
 */
let particleService: ParticleService | null = null

export function getParticleService(payload: Payload): ParticleService {
  if (!particleService) {
    particleService = new ParticleService(payload)
  }
  return particleService
}
