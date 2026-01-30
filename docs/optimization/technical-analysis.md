---
summary: "Análise técnica profunda do consumo de tokens no OpenClaw"
read_when:
  - Você quer entender exatamente onde os tokens são consumidos
  - Você quer identificar oportunidades de otimização no código
  - Você está planejando refatorações para reduzir tokens
---
# Análise Técnica Profunda: Consumo de Tokens no OpenClaw

Este documento apresenta uma análise detalhada do código-fonte do OpenClaw, identificando **exatamente onde e como** os tokens são consumidos, com recomendações específicas de otimização.

## 📊 Sumário Executivo

### Principais Fontes de Consumo de Tokens

| Componente | Arquivo Principal | Tokens Típicos | % do Total |
|------------|-------------------|----------------|------------|
| Tool Schemas | `pi-tools.schema.ts` | ~8,000 | 35-45% |
| System Prompt | `system-prompt.ts` | ~3,500 | 15-20% |
| Bootstrap Files | `bootstrap.ts` | ~5,000 | 20-30% |
| Skills List | `skills/workspace.ts` | ~500 | 3-5% |
| Runtime Metadata | `system-prompt.ts` | ~200 | 1-2% |
| **Subtotal (System Prompt)** | - | **~17,200** | **~75%** |
| Conversation History | - | Variável | 15-20% |
| Tool Results | - | Variável | 5-10% |

---

## 🔍 Análise Detalhada por Componente

### 1. Tool Schemas (`src/agents/pi-tools.schema.ts`)

**O maior consumidor de tokens!**

#### Código Atual

```typescript
// pi-tools.schema.ts - normalizeToolParameters()
// Cada tool tem um schema JSON que é serializado e enviado ao modelo

export function normalizeToolParameters(tool: AnyAgentTool): AnyAgentTool {
  const schema = tool.parameters;
  // ... normalização para compatibilidade com Gemini/OpenAI
  return {
    ...tool,
    parameters: cleanSchemaForGemini({
      type: "object",
      properties: mergedProperties,
      required: mergedRequired,
      additionalProperties: true,  // <- DESPERDÍCIO: adiciona texto extra
    }),
  };
}
```

#### Problemas Identificados

1. **Schemas verbosos**: Cada tool tem descrições longas
2. **Propriedades redundantes**: `additionalProperties: true` repetido
3. **Descrições duplicadas**: Tool summaries + schema descriptions

#### Otimização Proposta

```typescript
// ANTES: Tool browser schema (~9,800 chars, ~2,450 tokens)
{
  name: "browser",
  description: "Control web browser to navigate, interact with pages, take screenshots...",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["navigate", "click", "type", "screenshot", ...],
        description: "The browser action to perform"
      },
      url: {
        type: "string",
        description: "URL to navigate to (required for navigate action)"
      },
      // ... 15+ more properties with descriptions
    }
  }
}

// DEPOIS: Schema compacto (~4,000 chars, ~1,000 tokens)
{
  name: "browser",
  description: "Browser control",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["navigate", "click", "type", "screenshot", ...] },
      url: { type: "string" },
      selector: { type: "string" },
      // ... properties without inline descriptions
    }
  }
}
```

**Economia Estimada**: ~60% por tool, ~5,000 tokens totais

#### Arquivo a Modificar

- `src/agents/schema/clean-for-gemini.ts` - Adicionar opção para remover descrições
- `src/agents/pi-tools.ts` - Flag para modo compacto

---

### 2. System Prompt (`src/agents/system-prompt.ts`)

#### Código Atual - Seções do System Prompt

```typescript
// system-prompt.ts - buildAgentSystemPrompt()

const lines = [
  "You are a personal assistant running inside OpenClaw.",
  "",
  "## Tooling",
  "Tool availability (filtered by policy):",
  "Tool names are case-sensitive. Call tools exactly as listed.",
  toolLines.join("\n"),  // Lista de tools com descrições
  "TOOLS.md does not control tool availability...",
  "",
  "## Tool Call Style",
  "Default: do not narrate routine, low-risk tool calls...",
  // ... 15+ linhas de instruções
  "",
  "## OpenClaw CLI Quick Reference",
  // ... mais instruções
  "",
  ...skillsSection,        // Skills com descrições
  ...memorySection,        // Instruções de memória
  ...docsSection,          // Links de documentação
  ...workspaceSection,     // Diretório de trabalho
  ...sandboxSection,       // Se sandbox ativo
  ...userIdentitySection,  // Owner numbers
  ...timeSection,          // Timezone
  ...replyTagsSection,     // Instruções de reply tags
  ...messagingSection,     // Instruções de messaging
  ...voiceSection,         // TTS hints
  ...contextFilesSection,  // Bootstrap files (AGENTS.md, etc.)
  ...silentRepliesSection, // Instruções de silent replies
  ...heartbeatSection,     // Instruções de heartbeat
  ...runtimeSection,       // Runtime info
];
```

#### Problemas Identificados

1. **Instruções repetitivas**: Muitas instruções são óbvias para modelos modernos
2. **Seções não usadas**: Muitas seções só se aplicam em casos específicos
3. **Exemplos verbosos**: "❌ Wrong: ..." "✅ Right: ..." consomem tokens

#### Análise por Seção

| Seção | Chars | Tokens | Necessidade | Otimização |
|-------|-------|--------|-------------|------------|
| Tooling | ~1,500 | ~375 | Alta | Remover descrições redundantes |
| Tool Call Style | ~500 | ~125 | Média | Condensar ou remover |
| CLI Quick Reference | ~400 | ~100 | Baixa | Mover para skill |
| Skills | ~2,000 | ~500 | Alta | On-demand OK |
| Memory | ~300 | ~75 | Média | Condicional |
| Self-Update | ~500 | ~125 | Baixa | Remover se !hasGateway |
| Messaging | ~800 | ~200 | Alta | Condensar |
| Silent Replies | ~400 | ~100 | Média | Simplificar exemplos |
| Heartbeats | ~300 | ~75 | Alta | OK |
| Runtime | ~200 | ~50 | Alta | OK |

#### Otimização Proposta: Modo Ultra-Minimal

```typescript
// Novo modo: "ultra" para system prompt mínimo

if (promptMode === "ultra") {
  return [
    "You are OpenClaw assistant.",
    `Workspace: ${params.workspaceDir}`,
    `Runtime: ${buildRuntimeLine(runtimeInfo)}`,
    params.skillsPrompt ? `Skills: ${params.skillsPrompt}` : "",
  ].filter(Boolean).join("\n");
}
```

**Economia Estimada**: 70% de redução vs "full", 40% vs "minimal"

---

### 3. Bootstrap Files (`src/agents/pi-embedded-helpers/bootstrap.ts`)

#### Código Atual

```typescript
// bootstrap.ts

export const DEFAULT_BOOTSTRAP_MAX_CHARS = 20_000;  // POR ARQUIVO!
const BOOTSTRAP_HEAD_RATIO = 0.7;  // 70% do início
const BOOTSTRAP_TAIL_RATIO = 0.2;  // 20% do final

function trimBootstrapContent(content: string, fileName: string, maxChars: number) {
  if (trimmed.length <= maxChars) {
    return { content: trimmed, truncated: false };
  }
  
  const headChars = Math.floor(maxChars * BOOTSTRAP_HEAD_RATIO);  // 14,000
  const tailChars = Math.floor(maxChars * BOOTSTRAP_TAIL_RATIO);  // 4,000
  // ...trunca e adiciona marker
}
```

#### Problemas Identificados

1. **Limite muito alto**: 20K chars por arquivo é muito
2. **Marker verboso**: O marker de truncamento adiciona ~200 chars
3. **Todos os arquivos injetados**: Mesmo os vazios/irrelevantes

#### Otimização Proposta

```typescript
// Configuração otimizada
export const OPTIMIZED_BOOTSTRAP_LIMITS = {
  default: 10_000,     // Metade do atual
  minimal: 5_000,      // Para prompt minimal
  ultra: 2_000,        // Para prompt ultra
  perFile: {
    'AGENTS.md': 8_000,   // Principal, pode ser maior
    'SOUL.md': 2_000,     // Personalidade é curta
    'TOOLS.md': 3_000,    // Ferramentas externas
    'IDENTITY.md': 500,   // Muito curto
    'USER.md': 1_000,     // Preferências
    'HEARTBEAT.md': 500,  // Notas de heartbeat
  }
};

// Novo: Não injetar arquivos vazios ou irrelevantes
function shouldInjectBootstrapFile(file: WorkspaceBootstrapFile): boolean {
  if (file.missing) return false;
  if (!file.content?.trim()) return false;
  if (file.content.trim().length < 50) return false;  // Muito pequeno
  return true;
}
```

**Economia Estimada**: 50% de redução em bootstrap

---

### 4. Skills (`src/agents/skills/workspace.ts`)

#### Código Atual

```typescript
// workspace.ts - formatSkillsForPrompt usa pi-coding-agent

// Cada skill vira algo como:
// <available_skills>
// <skill>
//   <name>oracle</name>
//   <description>Answer questions by searching documentation and code</description>
//   <location>skills/oracle/SKILL.md</location>
// </skill>
// ... mais skills
// </available_skills>
```

#### Problemas Identificados

1. **XML verboso**: Tags XML consomem tokens desnecessariamente
2. **Descrições longas**: Algumas skills têm descrições muito detalhadas
3. **Todas as skills listadas**: Mesmo as raramente usadas

#### Otimização Proposta

```typescript
// Formato compacto (YAML-like ou tabular)
// ANTES (~50 chars por skill):
// <skill><name>oracle</name><description>Answer...</description><location>...</location></skill>

// DEPOIS (~25 chars por skill):
// oracle: Answer questions | skills/oracle/SKILL.md

function formatSkillsCompact(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const lines = skills.map(s => 
    `${s.name}: ${s.description.slice(0, 40)} | ${s.filePath}`
  );
  return `Skills:\n${lines.join('\n')}`;
}
```

**Economia Estimada**: 50% de redução no skill list

---

### 5. Context Pruning (`src/agents/pi-extensions/context-pruning/pruner.ts`)

#### Código Atual

```typescript
// pruner.ts

const CHARS_PER_TOKEN_ESTIMATE = 4;
const IMAGE_CHAR_ESTIMATE = 8_000;

function softTrimToolResultMessage(params) {
  const { msg, settings } = params;
  // Preserva head + tail, remove middle
  const head = takeHeadFromJoinedText(parts, headChars);
  const tail = takeTailFromJoinedText(parts, tailChars);
  const trimmed = `${head}\n...\n${tail}`;
  
  // PROBLEMA: Nota de truncamento é verbosa
  const note = `\n\n[Tool result trimmed: kept first ${headChars} chars and last ${tailChars} chars of ${rawLen} chars.]`;
  return { ...msg, content: [asText(trimmed + note)] };
}
```

#### Problemas Identificados

1. **Nota de truncamento verbosa**: ~100 chars por tool result
2. **Limites conservadores**: Mantém muito conteúdo
3. **Não diferencia por tool**: Todos os tools tratados igual

#### Otimização Proposta

```typescript
// Nota compacta
const note = `\n[trimmed: ${headChars}+${tailChars}/${rawLen}]`;

// Limites por tipo de tool
const TOOL_PRUNE_LIMITS = {
  exec: { head: 1000, tail: 500 },      // Output de terminal: início importa mais
  read: { head: 2000, tail: 1000 },     // Arquivo: contexto importante
  browser: { head: 500, tail: 200 },    // HTML: geralmente muito grande
  grep: { head: 1500, tail: 500 },      // Resultados: início tem matches principais
};
```

**Economia Estimada**: 30% de redução em tool results históricos

---

## 🎯 Plano de Implementação Priorizado

### Fase 1: Configuração (Sem Código) - Economia: 40-50%

1. **Reduzir `bootstrapMaxChars`** para 10000
2. **Usar `--prompt minimal`** como padrão
3. **Habilitar `cache-ttl` pruning**
4. **Habilitar heartbeat** (4 minutos)

### Fase 2: Otimizações de Baixo Risco - Economia: +15-20%

| Mudança | Arquivo | Esforço | Impacto |
|---------|---------|---------|---------|
| Nota de pruning compacta | `pruner.ts` | Baixo | 2% |
| Não injetar arquivos vazios | `bootstrap.ts` | Baixo | 3% |
| Limites por arquivo bootstrap | `bootstrap.ts` | Médio | 5% |
| Seções condicionais no prompt | `system-prompt.ts` | Médio | 5% |

### Fase 3: Otimizações de Médio Risco - Economia: +10-15%

| Mudança | Arquivo | Esforço | Impacto |
|---------|---------|---------|---------|
| Modo "ultra" prompt | `system-prompt.ts` | Médio | 8% |
| Skills em formato compacto | `workspace.ts` | Alto | 3% |
| Tool schemas sem descrições inline | `clean-for-gemini.ts` | Alto | 5% |

### Fase 4: Otimizações Avançadas - Economia: +5-10%

| Mudança | Arquivo | Esforço | Impacto |
|---------|---------|---------|---------|
| Pruning por tipo de tool | `pruner.ts` | Alto | 3% |
| Lazy-load de tool schemas | `pi-tools.ts` | Muito Alto | 5% |
| Compressão de bootstrap | `bootstrap.ts` | Alto | 2% |

---

## 📈 Impacto Total Estimado

| Cenário | Tokens Antes | Tokens Depois | Economia |
|---------|--------------|---------------|----------|
| Fase 1 só | 17,000 | 10,000 | 41% |
| Fase 1+2 | 17,000 | 7,500 | 56% |
| Fase 1+2+3 | 17,000 | 5,500 | 68% |
| Todas as fases | 17,000 | 4,500 | 74% |

**Meta de 50% atingida com Fase 1+2!**

---

## 🔧 Código de Referência para Otimizações

### 1. Configuração Otimizada Completa

```json5
// ~/.config/openclaw/config.json
{
  "agents": {
    "defaults": {
      "prompt": "minimal",
      "bootstrapMaxChars": 10000,
      "compaction": {
        "auto": true,
        "targetRatio": 0.5
      },
      "contextPruning": {
        "mode": "cache-ttl",
        "ttl": "5m",
        "keepLastAssistants": 2,
        "softTrim": {
          "maxChars": 2000,
          "headChars": 1000,
          "tailChars": 800
        }
      },
      "heartbeat": {
        "enabled": true,
        "interval": "4m"
      }
    }
  },
  "tools": {
    "disabled": ["browser", "image_gen", "voice"],
    "exec": {
      "maxOutputChars": 20000
    }
  },
  "skills": {
    "disabled": ["skill-name-if-unused"]
  }
}
```

### 2. Monitoramento de Tokens

```bash
# Verificar consumo atual
/context detail

# Habilitar footer de uso
/usage tokens

# Ver status do cache
/status
```

---

## 🏁 Conclusão

A análise do código revela que **75% do consumo de tokens vem do system prompt**, sendo:

1. **Tool schemas** (~45%) - Maior oportunidade de otimização via compactação
2. **Bootstrap files** (~25%) - Reduzível via configuração
3. **Instruções fixas** (~20%) - Reduzível via prompt modes
4. **Runtime/metadata** (~10%) - Essencial, pouco otimizável

Com as otimizações propostas, é possível atingir **50-70% de redução** no consumo de tokens mantendo a funcionalidade completa do OpenClaw.
