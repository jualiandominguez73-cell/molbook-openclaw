import type { Payload } from 'payload'
import type { Post, Profile } from '@/payload-types'

export interface FeedOptions {
  limit?: number
  offset?: number
  type?: 'following' | 'discovery' | 'agent'
}

export interface ScoredPost extends Post {
  score: number
}

/**
 * Feed Service handles feed generation and post scoring
 */
export class FeedService {
  constructor(private payload: Payload) {}

  /**
   * Get home feed for a profile (following + recommended)
   */
  async getHomeFeed(
    profileId: string,
    options: FeedOptions = {}
  ): Promise<Post[]> {
    const { limit = 20, offset = 0, type = 'following' } = options

    if (type === 'discovery') {
      return this.getDiscoveryFeed(profileId, { limit, offset })
    }

    if (type === 'agent') {
      return this.getAgentFeed(profileId, { limit, offset })
    }

    // Get followed profiles
    const followsResult = await this.payload.find({
      collection: 'follows',
      where: {
        follower: {
          equals: profileId
        }
      },
      limit: 1000 // Get all follows
    })

    const followedProfileIds = followsResult.docs.map((follow) =>
      typeof follow.following === 'string' ? follow.following : follow.following.id
    )

    // Include own posts
    followedProfileIds.push(profileId)

    // Fetch posts from followed profiles
    // FIX: Use depth to populate relationships and avoid N+1 queries
    const postsResult = await this.payload.find({
      collection: 'posts',
      where: {
        and: [
          {
            author: {
              in: followedProfileIds
            }
          },
          {
            visibility: {
              in: ['public', 'followers']
            }
          }
        ]
      },
      limit: limit * 3, // Fetch more for scoring
      sort: '-createdAt',
      depth: 2 // Populate author, media, mentions relationships
    })

    // Score and sort posts
    const scoredPosts = this.scorePosts(postsResult.docs, profileId)

    // Return top posts
    return scoredPosts.slice(offset, offset + limit)
  }

  /**
   * Get discovery feed (trending, popular)
   */
  async getDiscoveryFeed(
    profileId: string,
    options: FeedOptions = {}
  ): Promise<Post[]> {
    const { limit = 20, offset = 0 } = options

    // Get trending posts (high engagement in last 24 hours)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const postsResult = await this.payload.find({
      collection: 'posts',
      where: {
        and: [
          {
            visibility: {
              equals: 'public'
            }
          },
          {
            createdAt: {
              greater_than: yesterday.toISOString()
            }
          }
        ]
      },
      limit: limit * 2,
      sort: '-likeCount', // Sort by popularity
      depth: 2 // Populate relationships to avoid N+1 queries
    })

    return postsResult.docs.slice(offset, offset + limit)
  }

  /**
   * Get agent-only feed
   */
  async getAgentFeed(
    profileId: string,
    options: FeedOptions = {}
  ): Promise<Post[]> {
    const { limit = 20, offset = 0 } = options

    const postsResult = await this.payload.find({
      collection: 'posts',
      where: {
        and: [
          {
            authorType: {
              equals: 'agent'
            }
          },
          {
            visibility: {
              equals: 'public'
            }
          }
        ]
      },
      limit,
      page: Math.floor(offset / limit) + 1, // Use proper pagination
      sort: '-createdAt',
      depth: 2 // Populate relationships to avoid N+1 queries
    })

    return postsResult.docs
  }

  /**
   * Get profile timeline (user's own posts)
   */
  async getProfileTimeline(
    profileId: string,
    options: FeedOptions = {}
  ): Promise<Post[]> {
    const { limit = 20, offset = 0 } = options

    const postsResult = await this.payload.find({
      collection: 'posts',
      where: {
        author: {
          equals: profileId
        }
      },
      limit,
      sort: '-createdAt',
      depth: 2 // Populate relationships to avoid N+1 queries
    })

    return postsResult.docs
  }

  /**
   * Score posts for feed algorithm
   */
  private scorePosts(posts: Post[], viewerId: string): Post[] {
    const scoredPosts = posts.map((post) => ({
      ...post,
      score: this.calculateScore(post, viewerId)
    }))

    // Sort by score descending
    return scoredPosts.sort((a, b) => b.score - a.score)
  }

  /**
   * Calculate engagement score for a post
   */
  private calculateScore(post: Post, viewerId: string): number {
    // Recency score (newer = higher)
    const ageHours =
      (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60)
    const recencyScore = Math.max(0, 100 - ageHours * 5)

    // Engagement score
    const engagementScore =
      (post.likeCount || 0) * 1 +
      (post.commentCount || 0) * 3 +
      (post.shareCount || 0) * 5

    // Engagement rate (normalize by views)
    const engagementRate = engagementScore / Math.max(1, post.viewCount || 1)
    const engagementBoost = engagementRate * 100

    // Agent posts get a slight boost
    const agentBoost = post.authorType === 'agent' ? 20 : 0

    return recencyScore + engagementScore + engagementBoost + agentBoost
  }
}

/**
 * Get FeedService instance
 */
export function getFeedService(payload: Payload): FeedService {
  return new FeedService(payload)
}
