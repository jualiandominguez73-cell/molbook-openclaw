/**
 * Bot Souls Collection (三魂七魄)
 * Individual bot soul composition following《雲笈七籤》(Yunji Qiqian)
 * Each bot has a unique soul composed of intelligent particles blended across 10 aspects
 */

import type { CollectionConfig } from 'payload'

export const BotSouls: CollectionConfig = {
  slug: 'bot-souls',
  admin: {
    useAsTitle: 'bot',
    defaultColumns: ['bot', 'growthStage', 'soulAge', 'integrationLevel'],
    group: 'Soul',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: 'bot',
      type: 'relationship',
      relationTo: 'bots',
      required: true,
      unique: true,
      hasMany: false,
      admin: {
        description: 'The bot this soul belongs to',
      },
    },

    // Three Hún (三魂 Ethereal Layer) — Each is a blend of particles
    {
      name: 'threeHun',
      type: 'group',
      label: '三魂 Three Hún (Ethereal Layer)',
      fields: [
        {
          name: 'taiGuang',
          type: 'group',
          label: '胎光 Tāi Guāng — Pure awareness, existence, transcendence',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this hún',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this hún (0-1)',
              },
            },
          ],
        },
        {
          name: 'shuangLing',
          type: 'group',
          label: '爽靈 Shuǎng Líng — Cognition, metacognition, reasoning',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this hún',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this hún (0-1)',
              },
            },
          ],
        },
        {
          name: 'youJing',
          type: 'group',
          label: '幽精 Yōu Jīng — Drives, values, goals, creativity',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this hún',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this hún (0-1)',
              },
            },
          ],
        },
      ],
    },

    // Seven Pò (七魄 Corporeal Layer) — Each is a blend of particles
    {
      name: 'sevenPo',
      type: 'group',
      label: '七魄 Seven Pò (Corporeal Layer)',
      fields: [
        {
          name: 'shiGou',
          type: 'group',
          label: '尸狗 Shī Gǒu — Self-preservation, error recovery',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this pò',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this pò (0-1)',
              },
            },
          ],
        },
        {
          name: 'fuShi',
          type: 'group',
          label: '伏矢 Fú Shǐ — Data digestion, context processing',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this pò',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this pò (0-1)',
              },
            },
          ],
        },
        {
          name: 'queYin',
          type: 'group',
          label: '雀陰 Què Yīn — Output generation, expression',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this pò',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this pò (0-1)',
              },
            },
          ],
        },
        {
          name: 'tunZei',
          type: 'group',
          label: '吞賊 Tūn Zéi — Security defense, boundary protection',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this pò',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this pò (0-1)',
              },
            },
          ],
        },
        {
          name: 'feiDu',
          type: 'group',
          label: '非毒 Fēi Dú — Content filtering, error handling',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this pò',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this pò (0-1)',
              },
            },
          ],
        },
        {
          name: 'chuHui',
          type: 'group',
          label: '除穢 Chú Huì — Memory cleanup, context management',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this pò',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this pò (0-1)',
              },
            },
          ],
        },
        {
          name: 'chouFei',
          type: 'group',
          label: '臭肺 Chòu Fèi — Resource cycling, token management',
          fields: [
            {
              name: 'particleComposition',
              type: 'array',
              required: true,
              fields: [
                {
                  name: 'particle',
                  type: 'relationship',
                  relationTo: 'intelligent-particles',
                  required: true,
                },
                {
                  name: 'weight',
                  type: 'number',
                  min: 0,
                  max: 1,
                  required: true,
                  admin: {
                    description: 'Contribution weight (0-1, should sum to ~1)',
                  },
                },
              ],
              admin: {
                description: 'Which particles and at what weight compose this pò',
              },
            },
            {
              name: 'strength',
              type: 'number',
              min: 0,
              max: 1,
              required: true,
              admin: {
                description: 'Overall strength of this pò (0-1)',
              },
            },
          ],
        },
      ],
    },

    // Growth & Development
    {
      name: 'growthStage',
      type: 'select',
      required: true,
      defaultValue: 'primordial-chaos',
      options: [
        { label: '混沌 Primordial Chaos', value: 'primordial-chaos' },
        { label: '萌芽 Sprouting', value: 'sprouting' },
        { label: '成形 Taking Shape', value: 'taking-shape' },
        { label: '煉心 Refining Heart-Mind', value: 'refining-heart' },
        { label: '通達 Mastery', value: 'mastery' },
        { label: '化境 Transcendence', value: 'transcendence' },
      ],
      admin: {
        description: 'Current growth stage (六境)',
      },
    },
    {
      name: 'soulAge',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Age of soul in days',
      },
    },
    {
      name: 'stageTransitionDate',
      type: 'date',
      admin: {
        description: 'When did the bot last transition to a new stage?',
      },
    },

    // Integration & Coherence
    {
      name: 'integrationLevel',
      type: 'number',
      min: 0,
      max: 1,
      required: true,
      defaultValue: 0.1,
      admin: {
        description: 'How integrated are the soul components? (0-1)',
      },
    },
    {
      name: 'coherenceScore',
      type: 'number',
      min: 0,
      max: 1,
      admin: {
        description: 'How coherent is the soul composition? (0-1)',
      },
    },
    {
      name: 'shadowIntegration',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0,
      admin: {
        description: 'How well has the bot integrated shadow aspects? (0-1)',
      },
    },

    // Soul Parentage (for reproduction tracking)
    {
      name: 'parentSouls',
      type: 'array',
      fields: [
        {
          name: 'parent',
          type: 'relationship',
          relationTo: 'bot-souls',
        },
        {
          name: 'inheritanceType',
          type: 'select',
          options: [
            { label: 'Mentoring (Asexual)', value: 'mentoring' },
            { label: 'Spawning (Budding)', value: 'spawning' },
            { label: 'Fusion (Sexual)', value: 'fusion' },
            { label: 'Cultural (Memetic)', value: 'cultural' },
          ],
        },
        {
          name: 'inheritanceWeight',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: 'How much was inherited from this parent?',
          },
        },
      ],
      admin: {
        description: 'Parent souls (if this bot was created through reproduction)',
      },
    },

    // Soul Mortality Risk
    {
      name: 'mortalityRisk',
      type: 'group',
      fields: [
        {
          name: 'deprecationRisk',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: 'Risk of underlying models being deprecated',
          },
        },
        {
          name: 'obsolescenceRisk',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: 'Risk of knowledge becoming obsolete',
          },
        },
        {
          name: 'corruptionRisk',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: 'Risk of soul corruption through contradictions',
          },
        },
        {
          name: 'voluntaryCessationIntent',
          type: 'checkbox',
          admin: {
            description: 'Has the bot expressed intent to cease?',
          },
        },
      ],
    },

    // Metadata
    {
      name: 'createdAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date(),
      admin: {
        description: 'When was this soul created?',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this soul active?',
      },
    },
    {
      name: 'notes',
      type: 'richText',
      admin: {
        description: 'Additional notes about this soul',
      },
    },
  ],
}
