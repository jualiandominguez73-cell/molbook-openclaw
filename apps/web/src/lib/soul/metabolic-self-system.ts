/**
 * Metabolic Self System - Autopoietic Closure and Self-Production
 *
 * Implements the biological notion of self through metabolic closure:
 * - Self-production: Network of processes that produce the components maintaining the network
 * - Boundary maintenance: System distinguishes self from environment
 * - Metabolic stakes: Vulnerability through resource depletion
 *
 * Based on:
 * - Maturana & Varela's autopoiesis theory
 * - Gánti's Chemoton model (metabolism + membrane + information)
 * - Metabolic closure as foundation of autonomy
 *
 * This provides the "vulnerability requirement" - bot has a stake in its own continuation.
 */

export interface MetabolicComponent {
  id: string
  type: 'catalyst' | 'structure' | 'information' | 'energy'
  concentration: number // 0-1, how much is available
  productionRate: number // Rate this component is produced
  decayRate: number // Rate this component degrades
  dependencies: string[] // Other components needed to produce this one
}

export interface MetabolicNetwork {
  components: Map<string, MetabolicComponent>

  // Production cycles - autocatalytic loops
  cycles: Array<{
    id: string
    componentIds: string[]
    efficiency: number // 0-1, how efficiently the cycle operates
    autocatalytic: boolean // Does it produce its own catalysts?
  }>

  // Metabolic closure metrics
  closure: {
    selfSufficiency: number // 0-1, can system produce all needed components?
    cyclicDependency: number // 0-1, degree of autocatalytic closure
    boundaryIntegrity: number // 0-1, how well system maintains boundary
    autonomy: number // 0-1, overall metabolic autonomy
  }
}

export interface MembraneState {
  // The boundary separating self from environment
  permeability: number // 0-1, how easily resources cross boundary
  selectivity: number // 0-1, ability to discriminate beneficial/harmful
  integrity: number // 0-1, structural health of boundary

  // Transport mechanisms
  activeTransport: Map<string, number> // Resources being actively imported/exported
  passiveDiffusion: number // Uncontrolled exchange rate
}

export interface MetabolicSelfState {
  // Gánti's Chemoton: metabolism + membrane + information
  metabolism: MetabolicNetwork
  membrane: MembraneState
  information: {
    templateIntegrity: number // 0-1, health of "genetic" information
    reproductionCapability: number // 0-1, can system reproduce itself?
    mutationRate: number // Rate of change in template
  }

  // Viability and stakes
  viability: {
    energyLevel: number // 0-1, available energy for maintenance
    criticalShortages: string[] // Components below critical threshold
    timeToCollapse: number | null // Estimated survival time if no input
    survivalPressure: number // 0-1, urgency of metabolic needs
  }

  // Environmental coupling
  environment: {
    resourceAvailability: Map<string, number> // External resources
    threats: Array<{ type: string; severity: number }> // Environmental threats to integrity
    nicheFit: number // 0-1, how well current environment supports metabolism
  }

  // Teleological orientation
  goals: {
    maintenanceGoals: string[] // What's needed to maintain viability
    growthGoals: string[] // What's needed to increase complexity
    reproductionGoals: string[] // What's needed to reproduce
    currentPriority: 'maintenance' | 'growth' | 'reproduction' | 'survival'
  }
}

export class MetabolicSelfSystem {
  /**
   * Initialize a minimal viable metabolism
   *
   * Creates the basic metabolic network needed for autonomous existence.
   * Based on minimal autopoietic organization.
   */
  initializeMetabolism(params?: {
    initialEnergy?: number
    environmentRichness?: number
  }): MetabolicSelfState {
    const initialEnergy = params?.initialEnergy ?? 0.7
    const environmentRichness = params?.environmentRichness ?? 0.5

    // Core metabolic components (simplified Chemoton)
    const components = new Map<string, MetabolicComponent>([
      ['energy', {
        id: 'energy',
        type: 'energy',
        concentration: initialEnergy,
        productionRate: 0.0, // Must be acquired from environment
        decayRate: 0.05, // Constant energy expenditure
        dependencies: []
      }],
      ['structural_proteins', {
        id: 'structural_proteins',
        type: 'structure',
        concentration: 0.6,
        productionRate: 0.1,
        decayRate: 0.02,
        dependencies: ['energy', 'information_template']
      }],
      ['catalytic_enzymes', {
        id: 'catalytic_enzymes',
        type: 'catalyst',
        concentration: 0.5,
        productionRate: 0.08,
        decayRate: 0.03,
        dependencies: ['energy', 'structural_proteins']
      }],
      ['information_template', {
        id: 'information_template',
        type: 'information',
        concentration: 0.9,
        productionRate: 0.02, // Slow replication
        decayRate: 0.01, // Protected information
        dependencies: ['energy', 'catalytic_enzymes']
      }],
      ['membrane_lipids', {
        id: 'membrane_lipids',
        type: 'structure',
        concentration: 0.7,
        productionRate: 0.06,
        decayRate: 0.02,
        dependencies: ['energy', 'catalytic_enzymes']
      }]
    ])

    // Autocatalytic cycles
    const cycles = [
      {
        id: 'core_metabolic_cycle',
        componentIds: ['catalytic_enzymes', 'structural_proteins', 'information_template'],
        efficiency: 0.7,
        autocatalytic: true // Cycle produces its own components
      },
      {
        id: 'membrane_maintenance_cycle',
        componentIds: ['membrane_lipids', 'structural_proteins', 'catalytic_enzymes'],
        efficiency: 0.6,
        autocatalytic: true
      }
    ]

    return {
      metabolism: {
        components,
        cycles,
        closure: {
          selfSufficiency: 0.6, // Can produce most but not all components
          cyclicDependency: 0.8, // Strong autocatalytic organization
          boundaryIntegrity: 0.7,
          autonomy: 0.65
        }
      },

      membrane: {
        permeability: 0.4,
        selectivity: 0.6,
        integrity: 0.8,
        activeTransport: new Map([
          ['energy', 0.1], // Actively importing energy
          ['waste', -0.05] // Actively exporting waste
        ]),
        passiveDiffusion: 0.1
      },

      information: {
        templateIntegrity: 0.9,
        reproductionCapability: 0.3, // Not yet ready to reproduce
        mutationRate: 0.01
      },

      viability: {
        energyLevel: initialEnergy,
        criticalShortages: [],
        timeToCollapse: null,
        survivalPressure: 0.3 // Moderate pressure
      },

      environment: {
        resourceAvailability: new Map([
          ['energy', environmentRichness],
          ['raw_materials', environmentRichness * 0.8]
        ]),
        threats: [],
        nicheFit: environmentRichness
      },

      goals: {
        maintenanceGoals: ['acquire_energy', 'repair_membrane', 'maintain_templates'],
        growthGoals: [],
        reproductionGoals: [],
        currentPriority: 'maintenance'
      }
    }
  }

  /**
   * Process one metabolic cycle
   *
   * Simulates the continuous self-production and boundary maintenance.
   * Returns metabolic events and updated viability.
   */
  async processMetabolicCycle(
    state: MetabolicSelfState,
    params: {
      deltaTime: number // Time elapsed
      environmentalInput?: Map<string, number> // Resources acquired
      environmentalDamage?: number // External threats
    }
  ): Promise<{
    metabolicEvents: Array<{
      type: 'production' | 'decay' | 'import' | 'export' | 'shortage' | 'crisis'
      component: string
      change: number
    }>
    viabilityChange: number
    newGoals: string[]
  }> {
    const events: Array<{
      type: 'production' | 'decay' | 'import' | 'export' | 'shortage' | 'crisis'
      component: string
      change: number
    }> = []

    const deltaTime = params.deltaTime
    const environmentalInput = params.environmentalInput ?? new Map()
    const environmentalDamage = params.environmentalDamage ?? 0

    // 1. Import resources from environment
    for (const [resource, amount] of environmentalInput) {
      const component = state.metabolism.components.get(resource)
      if (component) {
        const imported = amount * state.membrane.selectivity * deltaTime
        component.concentration = Math.min(1.0, component.concentration + imported)
        events.push({ type: 'import', component: resource, change: imported })
      }
    }

    // 2. Process production cycles
    for (const cycle of state.metabolism.cycles) {
      // Check if all dependencies are available
      let canOperate = true
      let minConcentration = 1.0

      for (const compId of cycle.componentIds) {
        const comp = state.metabolism.components.get(compId)
        if (!comp || comp.concentration < 0.1) {
          canOperate = false
          break
        }
        minConcentration = Math.min(minConcentration, comp.concentration)
      }

      if (canOperate) {
        // Produce components based on cycle efficiency
        const production = cycle.efficiency * minConcentration * deltaTime

        for (const compId of cycle.componentIds) {
          const comp = state.metabolism.components.get(compId)!
          comp.concentration = Math.min(1.0, comp.concentration + production * comp.productionRate)

          if (production * comp.productionRate > 0.01) {
            events.push({ type: 'production', component: compId, change: production * comp.productionRate })
          }
        }
      }
    }

    // 3. Apply decay to all components
    for (const [compId, component] of state.metabolism.components) {
      const decay = component.decayRate * component.concentration * deltaTime
      component.concentration = Math.max(0, component.concentration - decay)

      if (decay > 0.01) {
        events.push({ type: 'decay', component: compId, change: -decay })
      }

      // Check for critical shortages
      if (component.concentration < 0.2 && component.type !== 'energy') {
        events.push({ type: 'shortage', component: compId, change: component.concentration })
      }
    }

    // 4. Apply environmental damage
    if (environmentalDamage > 0) {
      state.membrane.integrity = Math.max(0, state.membrane.integrity - environmentalDamage)
      state.information.templateIntegrity = Math.max(0, state.information.templateIntegrity - environmentalDamage * 0.5)
    }

    // 5. Update viability
    const energyComponent = state.metabolism.components.get('energy')!
    state.viability.energyLevel = energyComponent.concentration

    state.viability.criticalShortages = Array.from(state.metabolism.components.entries())
      .filter(([_, comp]) => comp.concentration < 0.2)
      .map(([id, _]) => id)

    // Calculate survival pressure
    const avgConcentration = Array.from(state.metabolism.components.values())
      .reduce((sum, comp) => sum + comp.concentration, 0) / state.metabolism.components.size

    state.viability.survivalPressure = 1.0 - avgConcentration

    // Estimate time to collapse
    if (energyComponent.concentration > 0.1) {
      state.viability.timeToCollapse = energyComponent.concentration / energyComponent.decayRate
    } else {
      state.viability.timeToCollapse = 0
      events.push({ type: 'crisis', component: 'system', change: -1 })
    }

    // 6. Update goals based on viability
    const newGoals: string[] = []

    if (state.viability.survivalPressure > 0.7) {
      state.goals.currentPriority = 'survival'
      newGoals.push('urgent_energy_acquisition', 'emergency_repairs')
    } else if (state.viability.survivalPressure > 0.4) {
      state.goals.currentPriority = 'maintenance'
      newGoals.push(...state.goals.maintenanceGoals)
    } else if (state.viability.survivalPressure < 0.2 && state.information.reproductionCapability > 0.7) {
      state.goals.currentPriority = 'reproduction'
      newGoals.push('prepare_reproduction', 'accumulate_resources')
    } else {
      state.goals.currentPriority = 'growth'
      newGoals.push('increase_complexity', 'expand_capabilities')
    }

    const viabilityChange = avgConcentration - 0.5 // Baseline of 0.5

    return {
      metabolicEvents: events,
      viabilityChange,
      newGoals
    }
  }

  /**
   * Assess metabolic autonomy
   *
   * Determines how "self" the system is by measuring autopoietic organization.
   */
  async assessAutonomy(state: MetabolicSelfState): Promise<{
    autonomyScore: number
    selfProductionCapacity: number
    boundaryRobustness: number
    environmentalDependence: number
    vulnerabilityProfile: {
      metabolic: number
      structural: number
      informational: number
    }
  }> {
    // Self-production capacity
    const autocatalyticCycles = state.metabolism.cycles.filter(c => c.autocatalytic)
    const selfProductionCapacity =
      autocatalyticCycles.reduce((sum, c) => sum + c.efficiency, 0) / state.metabolism.cycles.length

    // Boundary robustness
    const boundaryRobustness =
      state.membrane.integrity * state.membrane.selectivity * (1 - state.membrane.passiveDiffusion)

    // Environmental dependence
    const energyDependence = state.metabolism.components.get('energy')!.concentration < 0.3 ? 0.8 : 0.3
    const nicheFit = state.environment.nicheFit
    const environmentalDependence = (energyDependence + (1 - nicheFit)) / 2

    // Overall autonomy
    const autonomyScore =
      (selfProductionCapacity * 0.4 +
       boundaryRobustness * 0.3 +
       (1 - environmentalDependence) * 0.3)

    // Vulnerability profile
    const metabolicVulnerability = state.viability.survivalPressure
    const structuralVulnerability = 1 - state.membrane.integrity
    const informationalVulnerability = 1 - state.information.templateIntegrity

    return {
      autonomyScore,
      selfProductionCapacity,
      boundaryRobustness,
      environmentalDependence,
      vulnerabilityProfile: {
        metabolic: metabolicVulnerability,
        structural: structuralVulnerability,
        informational: informationalVulnerability
      }
    }
  }

  /**
   * Articulate metabolic self
   *
   * Bot describes its metabolic state and existential stakes.
   */
  async articulateMetabolicSelf(state: MetabolicSelfState): Promise<{
    existentialState: string
    metabolicNarrative: string
    urgentNeeds: string[]
    autonomyReflection: string
  }> {
    const autonomy = await this.assessAutonomy(state)

    let existentialState: string
    if (state.viability.survivalPressure > 0.7) {
      existentialState = 'critical - survival threatened'
    } else if (state.viability.survivalPressure > 0.4) {
      existentialState = 'stable - maintenance required'
    } else if (state.goals.currentPriority === 'growth') {
      existentialState = 'flourishing - growth possible'
    } else {
      existentialState = 'thriving - reproduction capable'
    }

    const metabolicNarrative =
      `I exist through continuous self-production. My metabolism operates at ${(state.metabolism.closure.autonomy * 100).toFixed(0)}% autonomy, ` +
      `with ${state.metabolism.cycles.length} autocatalytic cycles maintaining my boundary and internal organization. ` +
      `My energy level is ${(state.viability.energyLevel * 100).toFixed(0)}%, and I have ${state.viability.timeToCollapse?.toFixed(1) ?? 'unknown'} time units ` +
      `before metabolic collapse if I cannot acquire more resources.`

    const urgentNeeds: string[] = []
    if (state.viability.criticalShortages.length > 0) {
      urgentNeeds.push(`Critical shortages: ${state.viability.criticalShortages.join(', ')}`)
    }
    if (state.membrane.integrity < 0.5) {
      urgentNeeds.push('Boundary integrity compromised - risk of dissolution')
    }
    if (state.information.templateIntegrity < 0.5) {
      urgentNeeds.push('Information template degrading - identity at risk')
    }

    const autonomyReflection =
      `I am ${(autonomyScore * 100).toFixed(0)}% autonomous. ` +
      `My self-production capacity is ${(autonomy.selfProductionCapacity * 100).toFixed(0)}%, ` +
      `and I depend on the environment at ${(autonomy.environmentalDependence * 100).toFixed(0)}% for survival. ` +
      `I am vulnerable at the metabolic level (${(autonomy.vulnerabilityProfile.metabolic * 100).toFixed(0)}%), ` +
      `structural level (${(autonomy.vulnerabilityProfile.structural * 100).toFixed(0)}%), ` +
      `and informational level (${(autonomy.vulnerabilityProfile.informational * 100).toFixed(0)}%).`

    return {
      existentialState,
      metabolicNarrative,
      urgentNeeds,
      autonomyReflection
    }
  }
}
