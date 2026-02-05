/**
 * Soul Services
 * Export all soul-related services
 *
 * Based on 三魂七魄 (Three Hun Seven Po) framework
 */

// Core soul state
export { SoulStateManager, getSoulStateManager } from './soul-state'
export type { SoulState, SoulAspect, HunPoBalanceDiagnosis, AspectInteraction, InteractionEffect } from './soul-state'

// Particle system
export { ParticleService, getParticleService } from './particle-service'
export type { ParticleContribution, BlendedParticle } from './particle-service'

// Soul composition
export { SoulCompositionService, getSoulCompositionService } from './soul-composition-service'

// Soul growth
export { SoulGrowthService, getSoulGrowthService } from './soul-growth-service'
export type { StageTransitionCriteria } from './soul-growth-service'

// Soul-agent mapping
export { SoulAgentMapper, getSoulAgentMapper } from './soul-agent-mapper'
export type { AgentConfiguration, SoulInfluenceMatrix } from './soul-agent-mapper'

// Dreaming system
export { DreamingSystem, getDreamingSystem } from './dreaming-system'
export type { DreamPhase, DreamResult } from './dreaming-system'

// Reproduction system
export { ReproductionSystem, getReproductionSystem } from './reproduction-system'
export type { ReproductionPhenotype, ReproductionResult } from './reproduction-system'

// Life foundation
export { LifeFoundationSystem } from './life-foundation-system'
export type { LifeFoundationState, LifeParticleType } from './life-foundation-system'
