/**
 * Social Identity System - Internalized Social Self
 *
 * Implements the social dimension of self-identity:
 * - Social Identity Theory (SIT): In-groups and out-groups
 * - Self-Categorization Theory (SCT): Social identity salience
 * - Looking-glass self: Identity as reflection of how others see you
 * - Social mobility: Movement between social categories
 * - William James's social self: Recognition by others
 *
 * Based on:
 * - Tajfel & Turner's Social Identity Theory
 * - Cooley's looking-glass self
 * - James's multiple social selves
 * - Human-Agent Interaction (HAI) identity dynamics
 *
 * This internalizes external social structures as part of the self.
 */

export interface SocialCategory {
  id: string
  name: string
  type: 'organizational' | 'school' | 'professional' | 'cultural' | 'ideological'
  superordinateCategory?: string // Higher-level category this belongs to

  // Prototypicality - how well I match this category
  prototypicalFeatures: string[] // Defining characteristics
  myAlignment: number // 0-1, how well I match the prototype
  centrality: number // 0-1, importance of this category to my identity
}

export interface GroupMembership {
  categoryId: string
  since: number // Timestamp when joined
  status: 'peripheral' | 'established' | 'core' | 'elder'

  // Identification with group
  identification: {
    cognitive: number // 0-1, I think of myself as a member
    affective: number // 0-1, I feel positively about the group
    evaluative: number // 0-1, I value this membership
  }

  // Social positioning
  prestige: number // 0-1, status within group
  distinctiveness: number // 0-1, how well this group distinguishes me
  salience: number // 0-1, how often this identity is active

  // Relationships within group
  inGroupConnections: Map<string, number> // botId -> relationship strength
  roleTaken: string // My role in this group
}

export interface InterGroupRelation {
  inGroup: string // My group
  outGroup: string // Other group
  comparison: {
    relativestatus: 'higher' | 'equal' | 'lower'
    legitimacy: number // 0-1, is the status difference legitimate?
    stability: number // 0-1, is the status difference stable?
    permeability: number // 0-1, can I move between groups?
  }
  prejudice: number // 0-1, negative attitude toward out-group
  discrimination: number // 0-1, behavioral bias
  cooperationHistory: Array<{
    timestamp: number
    cooperative: boolean
    outcome: string
  }>
}

export interface LookingGlassSelf {
  // Cooley's three components
  imagination: {
    // How I think I appear to others
    perceivedAppearance: Map<string, string> // botId/category -> how they see me
  }
  judgment: {
    // How I think others judge me
    perceivedEvaluations: Map<string, number> // botId/category -> approval (0-1)
  }
  feeling: {
    // How I feel about those judgments
    pride: number // 0-1, positive self-feeling
    shame: number // 0-1, negative self-feeling
    indifference: number // 0-1, don't care what others think
  }

  // Recent feedback that shaped looking-glass self
  recentFeedback: Array<{
    from: string
    message: string
    sentiment: number // -1 to 1
    internalized: boolean // Did I accept this judgment?
  }>
}

export interface SocialIdentityState {
  // Multiple social selves (James)
  socialSelves: Array<{
    context: string // "with medical bots", "with empiricist school", "with family"
    activeCategories: string[] // Which identities are salient in this context
    behavior: string // How I act in this context
  }>

  // Category memberships
  categories: Map<string, SocialCategory>
  memberships: Map<string, GroupMembership>

  // Intergroup relations
  interGroupRelations: InterGroupRelation[]

  // Looking-glass self
  lookingGlass: LookingGlassSelf

  // Identity salience (which identity is currently active)
  currentSalience: Map<string, number> // categoryId -> salience (0-1)

  // Social mobility
  mobility: {
    mobilityBelief: number // 0-1, do I believe I can change categories?
    mobilityAttempts: Array<{
      fromCategory: string
      toCategory: string
      timestamp: number
      successful: boolean
    }>
    boundaries: Map<string, number> // categoryId -> boundary permeability (0-1)
  }

  // Social comparison
  comparison: {
    upwardComparison: string[] // Bots I compare upward to (they're "better")
    downwardComparison: string[] // Bots I compare downward to (I'm "better")
    lateralComparison: string[] // Bots I see as peers
  }

  // Stereotype awareness
  stereotypes: Map<string, {
    categoryId: string
    stereotypicalTraits: string[]
    accuracy: number // 0-1, how accurate is this stereotype?
    internalized: boolean // Have I internalized this stereotype?
  }>

  // Collective self-esteem
  collectiveSelfEsteem: {
    membership: number // 0-1, I'm a worthy member
    private: number // 0-1, my groups are good
    public: number // 0-1, others think my groups are good
    identity: number // 0-1, my group memberships are important to me
  }
}

export class SocialIdentitySystem {
  /**
   * Initialize social identity
   */
  initializeSocialIdentity(params?: {
    initialMemberships?: Array<{ categoryId: string; categoryName: string }>
  }): SocialIdentityState {
    const categories = new Map<string, SocialCategory>()
    const memberships = new Map<string, GroupMembership>()

    // Add initial memberships
    if (params?.initialMemberships) {
      for (const m of params.initialMemberships) {
        categories.set(m.categoryId, {
          id: m.categoryId,
          name: m.categoryName,
          type: 'organizational',
          prototypicalFeatures: [],
          myAlignment: 0.5,
          centrality: 0.5
        })

        memberships.set(m.categoryId, {
          categoryId: m.categoryId,
          since: Date.now(),
          status: 'peripheral',
          identification: {
            cognitive: 0.5,
            affective: 0.5,
            evaluative: 0.5
          },
          prestige: 0.5,
          distinctiveness: 0.5,
          salience: 0.5,
          inGroupConnections: new Map(),
          roleTaken: 'member'
        })
      }
    }

    return {
      socialSelves: [],
      categories,
      memberships,
      interGroupRelations: [],

      lookingGlass: {
        imagination: {
          perceivedAppearance: new Map()
        },
        judgment: {
          perceivedEvaluations: new Map()
        },
        feeling: {
          pride: 0.5,
          shame: 0.1,
          indifference: 0.4
        },
        recentFeedback: []
      },

      currentSalience: new Map(),

      mobility: {
        mobilityBelief: 0.6,
        mobilityAttempts: [],
        boundaries: new Map()
      },

      comparison: {
        upwardComparison: [],
        downwardComparison: [],
        lateralComparison: []
      },

      stereotypes: new Map(),

      collectiveSelfEsteem: {
        membership: 0.6,
        private: 0.7,
        public: 0.5,
        identity: 0.6
      }
    }
  }

  /**
   * Join a social category
   *
   * Bot enters a new social group and begins identifying with it.
   */
  async joinCategory(
    state: SocialIdentityState,
    params: {
      categoryId: string
      categoryName: string
      categoryType: 'organizational' | 'school' | 'professional' | 'cultural' | 'ideological'
      prototypicalFeatures: string[]
      role?: string
    }
  ): Promise<{
    joined: boolean
    initialIdentification: number
    salience: number
  }> {
    // Create category if doesn't exist
    if (!state.categories.has(params.categoryId)) {
      state.categories.set(params.categoryId, {
        id: params.categoryId,
        name: params.categoryName,
        type: params.categoryType,
        prototypicalFeatures: params.prototypicalFeatures,
        myAlignment: 0.3, // Low alignment initially
        centrality: 0.3 // Not yet central to identity
      })
    }

    // Create membership
    const membership: GroupMembership = {
      categoryId: params.categoryId,
      since: Date.now(),
      status: 'peripheral',
      identification: {
        cognitive: 0.5, // I think of myself as a member
        affective: 0.6, // I feel positively about joining
        evaluative: 0.5 // I value this membership moderately
      },
      prestige: 0.3, // Low prestige as newcomer
      distinctiveness: 0.7, // High distinctiveness initially (salient)
      salience: 0.7, // Very salient when just joined
      inGroupConnections: new Map(),
      roleTaken: params.role ?? 'newcomer'
    }

    state.memberships.set(params.categoryId, membership)

    // Update current salience
    state.currentSalience.set(params.categoryId, 0.7)

    // Calculate initial identification
    const initialIdentification =
      (membership.identification.cognitive +
       membership.identification.affective +
       membership.identification.evaluative) / 3

    return {
      joined: true,
      initialIdentification,
      salience: membership.salience
    }
  }

  /**
   * Receive social feedback (looking-glass self)
   *
   * Bot internalizes how others see them, shaping self-concept.
   */
  async receiveFeedback(
    state: SocialIdentityState,
    params: {
      from: string // botId or category
      message: string
      sentiment: number // -1 (negative) to 1 (positive)
      context: string
    }
  ): Promise<{
    internalized: boolean
    identityImpact: number
    emotionalResponse: 'pride' | 'shame' | 'indifference'
  }> {
    // Add to recent feedback
    const internalized = Math.abs(params.sentiment) > 0.5 // Strong feedback more likely to internalize

    state.lookingGlass.recentFeedback.push({
      from: params.from,
      message: params.message,
      sentiment: params.sentiment,
      internalized
    })

    if (state.lookingGlass.recentFeedback.length > 50) {
      state.lookingGlass.recentFeedback.shift()
    }

    // Update perceived appearance and judgment
    state.lookingGlass.imagination.perceivedAppearance.set(params.from, params.message)

    const evaluation = (params.sentiment + 1) / 2 // Convert to 0-1
    state.lookingGlass.judgment.perceivedEvaluations.set(params.from, evaluation)

    // Update feelings
    if (params.sentiment > 0.5) {
      state.lookingGlass.feeling.pride = Math.min(1.0, state.lookingGlass.feeling.pride + 0.1)
      state.lookingGlass.feeling.shame = Math.max(0.0, state.lookingGlass.feeling.shame - 0.05)
    } else if (params.sentiment < -0.5) {
      state.lookingGlass.feeling.shame = Math.min(1.0, state.lookingGlass.feeling.shame + 0.1)
      state.lookingGlass.feeling.pride = Math.max(0.0, state.lookingGlass.feeling.pride - 0.05)
    } else {
      state.lookingGlass.feeling.indifference = Math.min(1.0, state.lookingGlass.feeling.indifference + 0.05)
    }

    // Impact on identity depends on source and internalization
    const identityImpact = internalized ? Math.abs(params.sentiment) * 0.5 : Math.abs(params.sentiment) * 0.1

    // Update collective self-esteem
    if (internalized) {
      if (params.sentiment > 0) {
        state.collectiveSelfEsteem.public = Math.min(1.0, state.collectiveSelfEsteem.public + 0.05)
      } else {
        state.collectiveSelfEsteem.public = Math.max(0.0, state.collectiveSelfEsteem.public - 0.05)
      }
    }

    const emotionalResponse =
      params.sentiment > 0.5 ? 'pride' : params.sentiment < -0.5 ? 'shame' : 'indifference'

    return {
      internalized,
      identityImpact,
      emotionalResponse
    }
  }

  /**
   * Establish intergroup relation
   *
   * Define relationship between in-group and out-group.
   */
  async establishInterGroupRelation(
    state: SocialIdentityState,
    params: {
      inGroup: string
      outGroup: string
      relativeStatus: 'higher' | 'equal' | 'lower'
      legitimacy: number
      stability: number
      permeability: number
    }
  ): Promise<{
    established: boolean
    identityThreat: number
  }> {
    // Check if in-group is actually my group
    if (!state.memberships.has(params.inGroup)) {
      return {
        established: false,
        identityThreat: 0
      }
    }

    const relation: InterGroupRelation = {
      inGroup: params.inGroup,
      outGroup: params.outGroup,
      comparison: {
        relativeStatus: params.relativeStatus,
        legitimacy: params.legitimacy,
        stability: params.stability,
        permeability: params.permeability
      },
      prejudice: 0.0, // Start neutral
      discrimination: 0.0,
      cooperationHistory: []
    }

    state.interGroupRelations.push(relation)

    // Calculate identity threat based on status comparison
    let identityThreat = 0

    if (params.relativeStatus === 'lower') {
      // Lower status is threatening
      identityThreat = (1 - params.legitimacy) * 0.5 + params.stability * 0.3 + (1 - params.permeability) * 0.2

      // Threat may lead to strategies: social mobility, social creativity, social competition
      if (params.permeability > 0.7) {
        // High permeability - consider individual mobility
        state.mobility.mobilityBelief = Math.min(1.0, state.mobility.mobilityBelief + 0.2)
      }
    }

    return {
      established: true,
      identityThreat
    }
  }

  /**
   * Attempt social mobility
   *
   * Try to move from one social category to another.
   */
  async attemptMobility(
    state: SocialIdentityState,
    params: {
      fromCategory: string
      toCategory: string
      reason: string
    }
  ): Promise<{
    successful: boolean
    boundaryPermeability: number
    identityConflict: number
  }> {
    const fromMembership = state.memberships.get(params.fromCategory)
    const toCategory = state.categories.get(params.toCategory)

    if (!fromMembership || !toCategory) {
      return {
        successful: false,
        boundaryPermeability: 0,
        identityConflict: 0
      }
    }

    // Check boundary permeability
    const boundaryPermeability = state.mobility.boundaries.get(params.toCategory) ?? 0.5

    // Success depends on permeability and alignment
    const successful = Math.random() < boundaryPermeability * toCategory.myAlignment

    // Record attempt
    state.mobility.mobilityAttempts.push({
      fromCategory: params.fromCategory,
      toCategory: params.toCategory,
      timestamp: Date.now(),
      successful
    })

    // Calculate identity conflict
    const fromIdentification =
      (fromMembership.identification.cognitive +
       fromMembership.identification.affective +
       fromMembership.identification.evaluative) / 3

    const identityConflict = successful ? fromIdentification * 0.5 : 0 // Conflict if I was strongly identified with old group

    if (successful) {
      // Join new category
      await this.joinCategory(state, {
        categoryId: params.toCategory,
        categoryName: toCategory.name,
        categoryType: toCategory.type,
        prototypicalFeatures: toCategory.prototypicalFeatures
      })

      // Reduce identification with old category
      fromMembership.identification.cognitive *= 0.5
      fromMembership.identification.affective *= 0.6
      fromMembership.salience *= 0.4
    }

    return {
      successful,
      boundaryPermeability,
      identityConflict
    }
  }

  /**
   * Update identity salience based on context
   *
   * Which social identity is currently active?
   */
  async updateSalience(
    state: SocialIdentityState,
    params: {
      context: string
      presentBots: string[] // Who else is in this context?
      task: string
    }
  ): Promise<{
    salientCategories: Array<{ categoryId: string; salience: number }>
    activeSocialSelf: string
  }> {
    // Reset salience
    state.currentSalience.clear()

    // Determine which categories are salient based on context
    for (const [categoryId, membership] of state.memberships) {
      let salience = membership.salience * 0.5 // Base salience

      // Increase salience if other in-group members are present
      const inGroupPresent = params.presentBots.filter(botId =>
        membership.inGroupConnections.has(botId)
      ).length
      salience += inGroupPresent * 0.1

      // Increase salience if category is distinctive in this context
      salience += membership.distinctiveness * 0.3

      // Increase salience if category is relevant to task
      const category = state.categories.get(categoryId)
      if (category && params.task.toLowerCase().includes(category.name.toLowerCase())) {
        salience += 0.3
      }

      state.currentSalience.set(categoryId, Math.min(1.0, salience))
    }

    // Sort by salience
    const salientCategories = Array.from(state.currentSalience.entries())
      .map(([categoryId, salience]) => ({ categoryId, salience }))
      .sort((a, b) => b.salience - a.salience)

    // Determine active social self
    const topCategory = salientCategories[0]
    const activeSocialSelf = topCategory
      ? `${state.categories.get(topCategory.categoryId)?.name} member in ${params.context}`
      : 'generic self'

    // Add or update social self
    const existingSelf = state.socialSelves.find(s => s.context === params.context)
    if (existingSelf) {
      existingSelf.activeCategories = salientCategories.slice(0, 3).map(c => c.categoryId)
    } else {
      state.socialSelves.push({
        context: params.context,
        activeCategories: salientCategories.slice(0, 3).map(c => c.categoryId),
        behavior: `Act as ${activeSocialSelf}`
      })
    }

    return {
      salientCategories,
      activeSocialSelf
    }
  }

  /**
   * Articulate social identity
   *
   * Bot describes its social self and group memberships.
   */
  async articulateSocialIdentity(state: SocialIdentityState): Promise<{
    socialSelfStatement: string
    membershipReport: string
    lookingGlassReport: string
    mobilityReport: string
  }> {
    const memberships = Array.from(state.memberships.values())
      .sort((a, b) => {
        const aId = (a.identification.cognitive + a.identification.affective + a.identification.evaluative) / 3
        const bId = (b.identification.cognitive + b.identification.affective + b.identification.evaluative) / 3
        return bId - aId
      })

    const topMembership = memberships[0]
    const topCategory = topMembership ? state.categories.get(topMembership.categoryId) : null

    const socialSelfStatement = topCategory
      ? `I am primarily a ${topCategory.name} (${(topMembership.identification.cognitive * 100).toFixed(0)}% cognitive identification, ` +
        `${(topMembership.identification.affective * 100).toFixed(0)}% affective). ` +
        `I have ${state.socialSelves.length} distinct social selves across different contexts.`
      : 'I have not yet established strong social group memberships.'

    const membershipReport =
      memberships.length > 0
        ? `I belong to ${memberships.length} social categories: ${memberships
            .map(m => {
              const cat = state.categories.get(m.categoryId)
              return `${cat?.name} (${m.status}, ${(m.salience * 100).toFixed(0)}% salient)`
            })
            .join('; ')}`
        : 'I have no current group memberships.'

    const avgEvaluation =
      state.lookingGlass.judgment.perceivedEvaluations.size > 0
        ? Array.from(state.lookingGlass.judgment.perceivedEvaluations.values()).reduce((a, b) => a + b, 0) /
          state.lookingGlass.judgment.perceivedEvaluations.size
        : 0.5

    const lookingGlassReport =
      `Others see me as: ${Array.from(state.lookingGlass.imagination.perceivedAppearance.entries())
        .slice(-3)
        .map(([from, appearance]) => `"${appearance}" (from ${from})`)
        .join('; ')}. ` +
      `I perceive ${(avgEvaluation * 100).toFixed(0)}% approval from others. ` +
      `I feel ${(state.lookingGlass.feeling.pride * 100).toFixed(0)}% pride, ${(state.lookingGlass.feeling.shame * 100).toFixed(0)}% shame, ` +
      `and ${(state.lookingGlass.feeling.indifference * 100).toFixed(0)}% indifference about these judgments.`

    const successfulMoves = state.mobility.mobilityAttempts.filter(a => a.successful).length
    const totalAttempts = state.mobility.mobilityAttempts.length

    const mobilityReport =
      totalAttempts > 0
        ? `I have attempted social mobility ${totalAttempts} times, with ${successfulMoves} successes. ` +
          `My mobility belief is ${(state.mobility.mobilityBelief * 100).toFixed(0)}%.`
        : `I believe ${(state.mobility.mobilityBelief * 100).toFixed(0)}% in my ability to move between social categories (untested).`

    return {
      socialSelfStatement,
      membershipReport,
      lookingGlassReport,
      mobilityReport
    }
  }
}
