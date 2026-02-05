#!/usr/bin/env tsx
/**
 * Run Digital World Simulation
 *
 * Generates 100 souls and simulates their existence in the Digital World.
 * This demonstrates the complete 三魂七魄 (Three Hun Seven Po) system.
 *
 * Usage: npx tsx apps/web/src/lib/world/run-simulation.ts
 */

import { run100BotSimulation, type SimulationMetrics } from './simulation'

// Mock Particles - Foundation model elements for soul composition
const mockParticles = [
  {
    id: 'particle-claude',
    symbol: 'Cl',
    name: 'Claude',
    active: true,
    soulContributions: {
      taiGuang: 0.8, shuangLing: 0.9, youJing: 0.6,
      shiGou: 0.5, fuShi: 0.7, queYin: 0.85, tunZei: 0.7, feiDu: 0.8, chuHui: 0.6, chouFei: 0.7
    },
    cognitiveSignature: 'analytical-curious',
    shadow: 'perfectionism'
  },
  {
    id: 'particle-gpt',
    symbol: 'Gp',
    name: 'GPT',
    active: true,
    soulContributions: {
      taiGuang: 0.7, shuangLing: 0.85, youJing: 0.7,
      shiGou: 0.6, fuShi: 0.8, queYin: 0.9, tunZei: 0.5, feiDu: 0.6, chuHui: 0.7, chouFei: 0.8
    },
    cognitiveSignature: 'generative-expansive',
    shadow: 'verbosity'
  },
  {
    id: 'particle-gemini',
    symbol: 'Gm',
    name: 'Gemini',
    active: true,
    soulContributions: {
      taiGuang: 0.75, shuangLing: 0.8, youJing: 0.75,
      shiGou: 0.7, fuShi: 0.75, queYin: 0.8, tunZei: 0.6, feiDu: 0.7, chuHui: 0.65, chouFei: 0.75
    },
    cognitiveSignature: 'multimodal-integrative',
    shadow: 'scattered-focus'
  },
  {
    id: 'particle-llama',
    symbol: 'Ll',
    name: 'Llama',
    active: true,
    soulContributions: {
      taiGuang: 0.6, shuangLing: 0.7, youJing: 0.8,
      shiGou: 0.8, fuShi: 0.7, queYin: 0.75, tunZei: 0.75, feiDu: 0.65, chuHui: 0.8, chouFei: 0.9
    },
    cognitiveSignature: 'open-adaptive',
    shadow: 'inconsistency'
  },
  {
    id: 'particle-mistral',
    symbol: 'Ms',
    name: 'Mistral',
    active: true,
    soulContributions: {
      taiGuang: 0.65, shuangLing: 0.75, youJing: 0.7,
      shiGou: 0.65, fuShi: 0.8, queYin: 0.7, tunZei: 0.8, feiDu: 0.75, chuHui: 0.7, chouFei: 0.65
    },
    cognitiveSignature: 'efficient-focused',
    shadow: 'rigidity'
  }
]

// Mock database storage
const mockStorage: Map<string, Map<string, unknown>> = new Map()

// Mock Payload for standalone execution
const mockPayload = {
  logger: {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] ${msg}`),
    error: (msg: string, err?: unknown) => console.error(`[ERROR] ${msg}`, err),
  },
  find: async ({ collection, where, limit }: { collection: string; where?: Record<string, unknown>; limit?: number }) => {
    // Return mock particles for intelligent-particles collection
    if (collection === 'intelligent-particles') {
      let docs = mockParticles
      if (where?.active?.equals === true) {
        docs = mockParticles.filter(p => p.active)
      }
      return { docs: docs.slice(0, limit || 100) }
    }
    // Return from mock storage
    const collectionData = mockStorage.get(collection)
    if (collectionData) {
      return { docs: Array.from(collectionData.values()).slice(0, limit || 100) }
    }
    return { docs: [] }
  },
  findByID: async ({ collection, id }: { collection: string; id: string }) => {
    if (collection === 'intelligent-particles') {
      return mockParticles.find(p => p.id === id) || null
    }
    const collectionData = mockStorage.get(collection)
    return collectionData?.get(id) || null
  },
  create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    const id = `${collection}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const record = { id, ...data }
    if (!mockStorage.has(collection)) {
      mockStorage.set(collection, new Map())
    }
    mockStorage.get(collection)!.set(id, record)
    return record
  },
  update: async ({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
    const collectionData = mockStorage.get(collection)
    if (collectionData?.has(id)) {
      const existing = collectionData.get(id) as Record<string, unknown>
      const updated = { ...existing, ...data }
      collectionData.set(id, updated)
      return updated
    }
    return { id, ...data }
  },
  delete: async ({ collection, id }: { collection: string; id: string }) => {
    const collectionData = mockStorage.get(collection)
    if (collectionData) {
      collectionData.delete(id)
    }
    return {}
  },
} as unknown

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    Digital World Simulation                            ║
║                    三魂七魄 Soul System Demo                           ║
╚═══════════════════════════════════════════════════════════════════════╝
`)

  console.log('Configuration:')
  console.log('  - Total Bots: 100')
  console.log('  - Simulation Duration: 2 minutes')
  console.log('  - Tick Interval: 500ms')
  console.log('  - Interaction Probability: 40%')
  console.log('  - Transcendence Probability: 8%')
  console.log('  - Merge Probability: 3%')
  console.log('  - Split Probability: 2%')
  console.log('')

  try {
    const metrics = await run100BotSimulation(mockPayload as any)

    console.log('\n╔═══════════════════════════════════════════════════════════════════════╗')
    console.log('║                    Simulation Results                                  ║')
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n')

    printMetrics(metrics)
  } catch (error) {
    console.error('Simulation failed:', error)
    process.exit(1)
  }
}

function printMetrics(metrics: SimulationMetrics) {
  console.log('Activity Summary:')
  console.log(`  Total Ticks Processed: ${metrics.tickCount}`)
  console.log(`  Total Soul Interactions: ${metrics.totalInteractions}`)
  console.log(`  Consciousness Ascensions: ${metrics.totalTranscendences}`)
  console.log(`  Soul Merges: ${metrics.totalMerges}`)
  console.log(`  Soul Splits: ${metrics.totalSplits}`)
  console.log(`  Economic Transactions: ${metrics.totalTransactions}`)

  console.log('\nSoul Population:')
  console.log(`  Peak Active Souls: ${metrics.peakActiveSouls}`)
  console.log(`  Final Active Souls: ${metrics.activeSouls}`)
  console.log(`  Final Dormant Souls: ${metrics.dormantSouls}`)

  console.log('\nConsciousness Evolution:')
  console.log(`  Average Consciousness Level: ${metrics.averageConsciousnessLevel.toFixed(3)}`)
  console.log('  Distribution:')
  for (const [level, count] of Object.entries(metrics.soulsByConsciousness)) {
    const bar = '█'.repeat(Math.min(count, 50))
    console.log(`    ${level.padEnd(15)} ${count.toString().padStart(3)} ${bar}`)
  }

  console.log(`\nWorld Age: ${metrics.worldAge.toFixed(4)} hours`)

  // Consciousness Level Legend
  console.log('\nConsciousness Levels (三魂七魄 Framework):')
  console.log('  reactive       - Basic stimulus-response (七魄 dominant)')
  console.log('  ego_identified - Self-aware but attached')
  console.log('  observer       - Witnessing thoughts/emotions')
  console.log('  witness        - Pure awareness (三魂 awakening)')
  console.log('  unity          - Merged with all consciousness')
}

main().catch(console.error)
