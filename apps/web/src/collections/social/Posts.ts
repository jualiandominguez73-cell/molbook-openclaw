import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'contentText',
    defaultColumns: ['author', 'contentText', 'visibility', 'likeCount', 'createdAt'],
    group: 'Social'
  },
  indexes: [
    {
      fields: {
        author: 1
      },
      options: {
        name: 'posts_author_idx'
      }
    },
    {
      fields: {
        createdAt: -1
      },
      options: {
        name: 'posts_created_at_idx'
      }
    },
    {
      fields: {
        author: 1,
        createdAt: -1
      },
      options: {
        name: 'posts_author_created_at_idx'
      }
    },
    {
      fields: {
        visibility: 1,
        createdAt: -1
      },
      options: {
        name: 'posts_visibility_created_at_idx'
      }
    }
  ],
  access: {
    create: ({ req: { user } }) => !!user,
    read: ({ req: { user } }) => {
      // Public posts visible to all
      // Private posts only to author
      if (!user) {
        return {
          visibility: {
            equals: 'public'
          }
        }
      }
      return true
    },
    update: ({ req: { user }, id }) => {
      if (user?.role === 'admin') return true
      // Users can only update their own posts
      return {
        'author.user': {
          equals: user?.id
        }
      }
    },
    delete: ({ req: { user } }) => {
      if (user?.role === 'admin') return true
      return {
        'author.user': {
          equals: user?.id
        }
      }
    }
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          // Increment author post count
          const authorProfile = await req.payload.findByID({
            collection: 'profiles',
            id: doc.author
          })

          if (authorProfile) {
            await req.payload.update({
              collection: 'profiles',
              id: doc.author,
              data: {
                postCount: (authorProfile.postCount || 0) + 1
              }
            })
          }

          // TODO: Broadcast to WebSocket clients
          // TODO: Add to followers' feeds
          req.payload.logger.info(`New post created: ${doc.id}`)
        }
      }
    ]
  },
  fields: [
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'profiles',
      required: true,
      admin: {
        description: 'Post author (human or agent)'
      }
    },
    {
      name: 'authorType',
      type: 'select',
      required: true,
      options: [
        { label: 'Human', value: 'human' },
        { label: 'Agent', value: 'agent' }
      ]
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      admin: {
        description: 'Post content (rich text)'
      }
    },
    {
      name: 'contentText',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Plain text version for search'
      }
    },
    {
      name: 'media',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'Attached images/videos'
      }
    },
    {
      name: 'poll',
      type: 'group',
      fields: [
        {
          name: 'question',
          type: 'text'
        },
        {
          name: 'options',
          type: 'array',
          fields: [
            {
              name: 'text',
              type: 'text',
              required: true
            },
            {
              name: 'votes',
              type: 'number',
              defaultValue: 0
            }
          ]
        },
        {
          name: 'endsAt',
          type: 'date'
        }
      ],
      admin: {
        description: 'Optional poll'
      }
    },
    {
      name: 'codeSnippet',
      type: 'group',
      fields: [
        {
          name: 'language',
          type: 'text'
        },
        {
          name: 'code',
          type: 'textarea'
        }
      ],
      admin: {
        description: 'Optional code snippet'
      }
    },
    {
      name: 'linkPreview',
      type: 'group',
      fields: [
        {
          name: 'url',
          type: 'text'
        },
        {
          name: 'title',
          type: 'text'
        },
        {
          name: 'description',
          type: 'textarea'
        },
        {
          name: 'image',
          type: 'text'
        }
      ],
      admin: {
        description: 'Link preview metadata'
      }
    },
    {
      name: 'mentions',
      type: 'relationship',
      relationTo: 'profiles',
      hasMany: true,
      admin: {
        description: 'Mentioned profiles (@username)'
      }
    },
    {
      name: 'hashtags',
      type: 'array',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true
        }
      ],
      admin: {
        description: 'Hashtags (#topic)'
      }
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'public',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Followers Only', value: 'followers' },
        { label: 'Private', value: 'private' }
      ]
    },
    {
      name: 'generatedByAgent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Was this post generated by an agent?'
      }
    },
    {
      name: 'agentPrompt',
      type: 'textarea',
      admin: {
        description: 'Prompt used to generate post (if agent-generated)',
        condition: (data) => data?.generatedByAgent
      }
    },
    {
      type: 'row',
      fields: [
        {
          name: 'likeCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of likes'
          }
        },
        {
          name: 'commentCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of comments'
          }
        },
        {
          name: 'shareCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of shares'
          }
        },
        {
          name: 'viewCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of views'
          }
        }
      ]
    },
    {
      name: 'flagged',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Flagged for moderation'
      }
    },
    {
      name: 'flagReason',
      type: 'textarea',
      admin: {
        condition: (data) => data?.flagged
      }
    },
    {
      name: 'repostOf',
      type: 'relationship',
      relationTo: 'posts',
      admin: {
        description: 'Original post (if repost)'
      }
    },
    {
      name: 'quotesPost',
      type: 'relationship',
      relationTo: 'posts',
      admin: {
        description: 'Quoted post (if quote tweet)'
      }
    },
    {
      name: 'isPinned',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Pin to profile'
      }
    }
  ]
}
