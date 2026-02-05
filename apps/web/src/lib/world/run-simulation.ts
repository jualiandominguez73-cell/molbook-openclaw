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

// Mock Payload for standalone execution
const mockPayload = {
  logger: {
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    warn: (msg: string) => console.warn(`[WARN] ${msg}`),
    error: (msg: string, err?: unknown) => console.error(`[ERROR] ${msg}`, err),
  },
  find: async () => ({ docs: [] }),
  findByID: async () => null,
  create: async (args: { data: Record<string, unknown> }) => ({ id: `mock-${Date.now()}`, ...args.data }),
  update: async () => ({}),
  delete: async () => ({}),
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
