const { MemoryClient } = require('mem0ai');

// Stub for tenant context until full middleware is implemented
function getOrgContext() {
  // TODO: Replace with AsyncLocalStorage implementation
  return {
    org_id: process.env.MEM0_ORG_ID || 'default_org',
    agent_id: 'default_agent',
    customer_id: 'unknown_customer',
    team_id: 'default_team'
  };
}

class OmnisMemory {
  constructor() {
    if (!process.env.MEM0_API_KEY) {
      console.warn('MEM0_API_KEY not set. Mem0 memory disabled.');
      this.client = null;
      return;
    }
    this.client = new MemoryClient({
      apiKey: process.env.MEM0_API_KEY
    });
  }

  async addMemory(content, scope, metadata = {}) {
    if (!this.client) return null;

    const ctx = getOrgContext();
    const memoryParams = {
      messages: [{ role: 'user', content }],
      metadata: {
        org_id: ctx.org_id,
        scope: scope,
        ...metadata
      }
    };

    // Scope-specific user_id for isolation
    switch (scope) {
      case 'customer':
        memoryParams.user_id = `${ctx.org_id}:customer:${metadata.customer_id || ctx.customer_id}`;
        break;
      case 'agent':
        memoryParams.user_id = `${ctx.org_id}:agent:${metadata.agent_id || ctx.agent_id}`;
        break;
      case 'team':
        memoryParams.user_id = `${ctx.org_id}:team:${metadata.team_id || ctx.team_id}`;
        break;
      case 'organization':
        memoryParams.user_id = `${ctx.org_id}:org`;
        break;
      default:
        memoryParams.user_id = `${ctx.org_id}:general`;
    }

    try {
      return await this.client.add(memoryParams);
    } catch (error) {
      console.error('Mem0 Add Error:', error);
      return null;
    }
  }

  async searchMemory(query, scopes = ['customer', 'agent', 'team', 'organization']) {
    if (!this.client) return [];

    const ctx = getOrgContext();
    const results = [];

    for (const scope of scopes) {
      let userId;
      switch (scope) {
        case 'customer':
          userId = `${ctx.org_id}:customer:${ctx.customer_id}`;
          break;
        case 'agent':
          userId = `${ctx.org_id}:agent:${ctx.agent_id}`;
          break;
        case 'team':
          userId = `${ctx.org_id}:team:${ctx.team_id}`;
          break;
        case 'organization':
          userId = `${ctx.org_id}:org`;
          break;
      }

      try {
        if (userId) {
            const scopeResults = await this.client.search(query, {
                user_id: userId,
                limit: 3
            });
            results.push(...scopeResults.map(r => ({
                ...r,
                scope,
                // Higher weight for more specific scopes
                weight: { customer: 1.0, agent: 0.8, team: 0.6, organization: 0.4 }[scope] || 0.5
            })));
        }
      } catch (error) {
        console.error(`Mem0 Search Error (${scope}):`, error);
      }
    }

    // Sort by weighted score
    return results.sort((a, b) => (b.score * b.weight) - (a.score * a.weight));
  }
}

// Export a singleton
module.exports = new OmnisMemory();
