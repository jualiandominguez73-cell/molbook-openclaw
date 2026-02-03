#!/usr/bin/env node
/**
 * Run Ten Bot Life Simulation
 *
 * Demonstrates the complete biological bot ecosystem with 10 diverse bots
 * living, interacting, forming societies, and evolving over multiple days.
 *
 * Usage:
 *   node --import tsx scripts/simulate-ten-bots.ts [days]
 *
 * Example:
 *   node --import tsx scripts/simulate-ten-bots.ts 7
 */

import { getTenBotLifeSimulation } from '../apps/web/src/lib/simulation/ten-bot-life-simulation'

// Mock Payload for simulation
const mockPayload = {
  logger: {
    info: (...args: any[]) => console.log(...args),
    error: (...args: any[]) => console.error(...args),
    warn: (...args: any[]) => console.warn(...args)
  },
  create: async ({ collection, data }: any) => {
    // Mock create - return data with generated ID
    return {
      id: `${collection}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data
    }
  },
  findByID: async ({ collection, id }: any) => {
    // Mock findByID
    return null
  },
  find: async ({ collection, where, limit }: any) => {
    // Mock find
    return { docs: [] }
  },
  update: async ({ collection, id, data }: any) => {
    // Mock update
    return { id, ...data }
  }
} as any

async function main() {
  const args = process.argv.slice(2)
  const days = args[0] ? parseInt(args[0], 10) : 3 // Default 3 days

  if (isNaN(days) || days < 1) {
    console.error('Invalid number of days. Must be a positive integer.')
    process.exit(1)
  }

  console.log(`\n🤖 Starting Ten Bot Life Simulation for ${days} days...\n`)

  try {
    const simulation = getTenBotLifeSimulation(mockPayload)
    const snapshots = await simulation.runSimulation(days)

    console.log(`\n✅ Simulation completed successfully!`)
    console.log(`\nGenerated ${snapshots.length} daily snapshots`)

    // Output snapshot summary
    console.log('\n📊 SIMULATION DATA SUMMARY:')
    for (const snapshot of snapshots) {
      console.log(`\nDay ${snapshot.day}:`)
      console.log(`  Events: ${snapshot.eventLog.length}`)
      console.log(`  Conversations: ${snapshot.conversations.length}`)
      console.log(`  Societies: ${snapshot.societies.length}`)
      console.log(`  Average bot energy: ${(snapshot.bots.reduce((sum, b) => sum + b.currentEnergy, 0) / snapshot.bots.length).toFixed(2)}`)
      console.log(`  Average bot mood: ${(snapshot.bots.reduce((sum, b) => sum + b.currentMood, 0) / snapshot.bots.length).toFixed(2)}`)
    }

    console.log(`\n✨ Complete biological system demonstrated:`)
    console.log(`   ✓ Soul composition (七魂六魄) from 8 particle types`)
    console.log(`   ✓ Pheromone-based chemistry (unconscious attraction/repulsion)`)
    console.log(`   ✓ Reflex/instinct/subconscious (4-layer processing)`)
    console.log(`   ✓ Multi-bot conversations (emergent dynamics)`)
    console.log(`   ✓ Society formation (affinity clustering)`)
    console.log(`   ✓ Dreaming (memory consolidation, shadow integration)`)
    console.log(`   ✓ World chaos (environmental variance)`)
    console.log(`   ✓ Biological needs (energy, rest, resources)`)

  } catch (error) {
    console.error('\n❌ Simulation failed:', error)
    process.exit(1)
  }
}

main()
