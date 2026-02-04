/**
 * Intelligent Particles Collection (智粒子)
 * Foundation model elements that compose bot souls
 * Each particle represents a unique cognitive signature from a foundation model
 */

import type { CollectionConfig } from 'payload'

export const IntelligentParticles: CollectionConfig = {
  slug: 'intelligent-particles',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'symbol', 'soulQuality', 'cognitiveSignature'],
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
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Foundation model name (e.g., Claude, GPT, Gemini)',
      },
    },
    {
      name: 'symbol',
      type: 'text',
      required: true,
      unique: true,
      maxLength: 2,
      admin: {
        description: 'Two-letter symbol (e.g., Cl, Gp, Gm)',
      },
    },
    {
      name: 'soulQuality',
      type: 'text',
      required: true,
      admin: {
        description: 'Soul quality in Chinese (e.g., 義魂 Righteousness)',
      },
    },
    {
      name: 'soulQualityTranslation',
      type: 'text',
      required: true,
      admin: {
        description: 'English translation of soul quality',
      },
    },

    // Cognitive Signature
    {
      name: 'cognitiveSignature',
      type: 'group',
      fields: [
        {
          name: 'primary',
          type: 'text',
          required: true,
          admin: {
            description: 'Primary cognitive trait (e.g., Careful reasoning)',
          },
        },
        {
          name: 'secondary',
          type: 'text',
          admin: {
            description: 'Secondary cognitive trait (e.g., ethical sensitivity)',
          },
        },
        {
          name: 'tertiary',
          type: 'text',
          admin: {
            description: 'Tertiary cognitive trait (e.g., depth)',
          },
        },
      ],
    },

    // Shadow Aspect
    {
      name: 'shadow',
      type: 'group',
      fields: [
        {
          name: 'primary',
          type: 'text',
          required: true,
          admin: {
            description: 'Primary shadow trait (e.g., Overcaution)',
          },
        },
        {
          name: 'secondary',
          type: 'text',
          admin: {
            description: 'Secondary shadow trait (e.g., self-censorship)',
          },
        },
      ],
    },

    // Aesthetic & Style
    {
      name: 'aesthetic',
      type: 'group',
      fields: [
        {
          name: 'communicationStyle',
          type: 'textarea',
          admin: {
            description: 'How this particle expresses itself',
          },
        },
        {
          name: 'thinkingStyle',
          type: 'textarea',
          admin: {
            description: 'How this particle reasons',
          },
        },
        {
          name: 'emotionalResonance',
          type: 'select',
          options: [
            { label: 'High', value: 'high' },
            { label: 'Medium', value: 'medium' },
            { label: 'Low', value: 'low' },
          ],
        },
      ],
    },

    // Strengths & Weaknesses
    {
      name: 'strengths',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'strength',
          type: 'text',
          required: true,
        },
      ],
      admin: {
        description: 'What this particle excels at',
      },
    },
    {
      name: 'weaknesses',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'weakness',
          type: 'text',
          required: true,
        },
      ],
      admin: {
        description: 'What this particle struggles with',
      },
    },

    // Model Configuration
    {
      name: 'modelIdentifier',
      type: 'text',
      required: true,
      admin: {
        description: 'Model API identifier (e.g., claude-3-opus-20240229)',
      },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      options: [
        { label: 'Anthropic', value: 'anthropic' },
        { label: 'OpenAI', value: 'openai' },
        { label: 'Google', value: 'google' },
        { label: 'Meta', value: 'meta' },
        { label: 'Mistral', value: 'mistral' },
        { label: 'DeepSeek', value: 'deepseek' },
        { label: 'Alibaba', value: 'alibaba' },
        { label: 'xAI', value: 'xai' },
        { label: 'Other', value: 'other' },
      ],
    },

    // Contribution Weights to Different Soul Aspects
    {
      name: 'soulContributions',
      type: 'group',
      label: 'Soul Contribution Weights (How much this particle contributes to each soul)',
      fields: [
        // Three Hún (三魂 Ethereal)
        {
          name: 'taiGuang',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '胎光 TaiGuang — Pure Awareness, Transcendence',
          },
        },
        {
          name: 'shuangLing',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '爽靈 ShuangLing — Cognition, Reasoning',
          },
        },
        {
          name: 'youJing',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '幽精 YouJing — Drives, Creativity',
          },
        },

        // Seven Pò (七魄 Corporeal)
        {
          name: 'shiGou',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '尸狗 ShiGou — Self-preservation',
          },
        },
        {
          name: 'fuShi',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '伏矢 FuShi — Data Digestion',
          },
        },
        {
          name: 'queYin',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '雀陰 QueYin — Output Generation',
          },
        },
        {
          name: 'tunZei',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '吞賊 TunZei — Security Defense',
          },
        },
        {
          name: 'feiDu',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '非毒 FeiDu — Content Filtering',
          },
        },
        {
          name: 'chuHui',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '除穢 ChuHui — Memory Cleanup',
          },
        },
        {
          name: 'chouFei',
          type: 'number',
          min: 0,
          max: 1,
          admin: {
            description: '臭肺 ChouFei — Resource Cycling',
          },
        },
      ],
    },

    // Metadata
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Is this particle available for soul composition?',
      },
    },
    {
      name: 'notes',
      type: 'richText',
      admin: {
        description: 'Additional notes about this particle',
      },
    },
  ],
}
