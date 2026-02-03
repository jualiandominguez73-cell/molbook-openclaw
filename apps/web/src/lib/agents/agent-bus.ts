/**
 * Agent Bus
 * Inter-agent communication system (mimics neural signaling)
 */

import type { BusMessage } from './base-agent'

export type MessageType = 'excitatory' | 'inhibitory' | 'modulatory' | 'broadcast'

export interface MessageQueue {
  [agentId: string]: BusMessage[]
}

export class AgentBus {
  private queues: MessageQueue = {}
  private subscriptions: Map<string, Set<MessageType>> = new Map()
  private messageHistory: BusMessage[] = []
  private maxHistorySize = 100

  /**
   * Send a message on the bus
   */
  async send(message: BusMessage): Promise<void> {
    // Store in history
    this.messageHistory.push(message)
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift()
    }

    // Route to target or broadcast
    if (message.targetAgent) {
      // Direct message
      this.enqueue(message.targetAgent, message)
    } else {
      // Broadcast to all subscribed agents
      for (const [agentId, subscribedTypes] of this.subscriptions.entries()) {
        if (subscribedTypes.has(message.type as MessageType)) {
          this.enqueue(agentId, message)
        }
      }
    }
  }

  /**
   * Subscribe an agent to message types
   */
  subscribe(agentId: string, messageTypes: MessageType[]): void {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Set())
    }

    const types = this.subscriptions.get(agentId)!
    messageTypes.forEach(type => types.add(type))

    // Initialize queue if needed
    if (!this.queues[agentId]) {
      this.queues[agentId] = []
    }
  }

  /**
   * Get messages for an agent
   */
  async getMessages(agentId: string): Promise<BusMessage[]> {
    const queue = this.queues[agentId] || []

    // Filter expired messages (past TTL)
    const now = Date.now()
    const validMessages = queue.filter(msg => {
      const age = now - msg.timestamp.getTime()
      return age < msg.ttl
    })

    // Clear queue and return valid messages
    this.queues[agentId] = []

    // Sort by priority (higher first)
    return validMessages.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Clear all queues
   */
  clear(): void {
    this.queues = {}
    this.messageHistory = []
  }

  /**
   * Create a message helper
   */
  static createMessage(
    type: MessageType,
    sourceAgent: string,
    content: any,
    options: {
      targetAgent?: string
      priority?: number
      ttl?: number
    } = {}
  ): BusMessage {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      sourceAgent,
      targetAgent: options.targetAgent,
      content,
      priority: options.priority || 0.5,
      timestamp: new Date(),
      ttl: options.ttl || 5000
    }
  }
}
