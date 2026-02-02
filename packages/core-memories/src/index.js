/**
 * CoreMemories v2.1 - With MEMORY.md Integration
 * Auto-proposes important memories for curated biography updates
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Default configuration
const DEFAULT_CONFIG = {
  enabled: true,
  compression: 'auto',
  autoInstall: true,
  
  // MEMORY.md integration
  memoryMd: {
    enabled: true,
    updateTriggers: {
      emotionalThreshold: 0.8,     // Auto-flag if emotional_salience > 0.8
      decisionTypes: ['decision', 'milestone', 'achievement'],
      userFlagged: true,           // When user says "remember this"
      reviewInterval: 7 * 24 * 60 * 60 * 1000  // Weekly review (7 days)
    },
    sections: {
      'decision': '## Decisions Made',
      'milestone': '## Milestones',
      'project': '## Projects',
      'learning': '## Key Learnings',
      'default': '## Important Memories'
    }
  },
  
  engines: {
    local: {
      provider: null,
      model: 'phi3:mini',
      endpoint: 'http://localhost:11434',
      available: false
    },
    api: {
      provider: null,
      model: null,
      apiKey: null,
      enabled: false
    }
  },
  
  fallback: {
    mode: 'rules',
    enabled: true
  },
  
  privacy: {
    defaultLevel: 'public',
    encryptSecrets: true
  }
};

let CONFIG = null;

// Utility functions
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function generateId() {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

function extractKeywords(text) {
  const stopWords = ['about', 'would', 'could', 'should', 'there', 'their', 'where', 'which', 'this', 'that', 'with', 'from', 'have', 'were', 'been', 'they', 'them', 'than', 'then'];
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.includes(w));
  return [...new Set(words)].slice(0, 8);
}

function calculateEmotionalSalience(text) {
  const emotionalWords = ['love', 'hate', 'amazing', 'terrible', 'excited', 'frustrated', 'proud', 'worried', 'happy', 'sad', 'angry', 'thrilled', 'awesome', 'disappointed', 'important', 'critical', 'essential'];
  const hasEmotion = emotionalWords.some(word => text.toLowerCase().includes(word));
  return hasEmotion ? 0.8 : 0.5;
}

// Check if user said "remember this"
function checkUserFlagged(text) {
  const flagPhrases = [
    'remember this',
    'remember that',
    'don\'t forget',
    'make sure to remember',
    'this is important',
    'write this down',
    'keep this in mind'
  ];
  return flagPhrases.some(phrase => text.toLowerCase().includes(phrase));
}

// Auto-detection: Check if Ollama is available
async function checkOllamaAvailable() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434/api/tags', (res) => {
      if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const models = JSON.parse(data);
            resolve({ available: true, models: models.models || [] });
          } catch {
            resolve({ available: true, models: [] });
          }
        });
      } else {
        resolve({ available: false, models: [] });
      }
    });
    
    req.on('error', () => resolve({ available: false, models: [] }));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve({ available: false, models: [] });
    });
  });
}

// Deep merge utility
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      target[key] = target[key] || {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Initialize configuration with auto-detection
async function initializeConfig() {
  if (CONFIG) return CONFIG;
  
  const configPath = path.join('.openclaw', 'core-memories-config.json');
  let userConfig = {};
  
  if (fs.existsSync(configPath)) {
    try {
      userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.warn('CoreMemories: Could not load user config, using defaults');
    }
  }
  
  // Deep merge instead of shallow spread
  CONFIG = deepMerge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), userConfig);
  
  console.log('🔍 CoreMemories: Detecting local LLM...');
  const ollamaCheck = await checkOllamaAvailable();
  
  if (ollamaCheck.available) {
    CONFIG.engines.local.available = true;
    CONFIG.engines.local.provider = 'ollama';
    
    const hasPreferred = ollamaCheck.models.some(m => m.name.includes(CONFIG.engines.local.model));
    if (!hasPreferred && ollamaCheck.models.length > 0) {
      CONFIG.engines.local.model = ollamaCheck.models[0].name;
    }
    
    console.log(`   ✓ Ollama detected (${CONFIG.engines.local.model})`);
  } else {
    console.log('   ⚠ Ollama not detected');
  }
  
  if (CONFIG.engines.local.available) {
    console.log('✓ CoreMemories active (LLM-enhanced compression)');
  } else {
    console.log('✓ CoreMemories active (rule-based compression)');
    console.log('  💡 Tip: Install Ollama for smarter memory compression');
  }
  
  return CONFIG;
}

// Compression engines
class RuleBasedCompression {
  compress(flashEntry) {
    const summary = flashEntry.content.length > 200 
      ? flashEntry.content.substring(0, 200) + '...'
      : flashEntry.content;

    const keyQuotes = [];
    const sentences = flashEntry.content.match(/[^.!?]+[.!?]+/g) || [];
    for (const sentence of sentences) {
      if (sentence.includes('"') || sentence.includes('remember') || sentence.includes('important')) {
        keyQuotes.push(sentence.trim());
      }
      if (keyQuotes.length >= 2) break;
    }

    return {
      id: flashEntry.id,
      timestamp: flashEntry.timestamp,
      summary,
      keyQuotes,
      emotionalTone: flashEntry.emotionalSalience > 0.7 ? 'high' : 'normal',
      keywords: flashEntry.keywords,
      linkedTo: flashEntry.linkedTo,
      privacyLevel: flashEntry.privacyLevel,
      compressionMethod: 'rules'
    };
  }
}

class OllamaCompression {
  async compress(flashEntry) {
    try {
      const prompt = `Summarize this conversation into a JSON object with:
- "hook": One sentence summary
- "keyPoints": Array of 3 key facts
- "keywords": Array of 5 keywords
- "emotionalTone": "high" or "normal"

Conversation: ${flashEntry.content.substring(0, 1000)}

Output only valid JSON:`;

      const response = await new Promise((resolve, reject) => {
        const postData = JSON.stringify({
          model: CONFIG.engines.local.model,
          prompt: prompt,
          stream: false
        });

        const req = http.request({
          hostname: 'localhost',
          port: 11434,
          path: '/api/generate',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve(result.response);
            } catch {
              reject(new Error('Invalid JSON from Ollama'));
            }
          });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Ollama timeout'));
        });
        
        req.write(postData);
        req.end();
      });

      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch {
        console.warn('CoreMemories: LLM returned invalid JSON, using fallback');
        const fallback = new RuleBasedCompression();
        return fallback.compress(flashEntry);
      }

      return {
        id: flashEntry.id,
        timestamp: flashEntry.timestamp,
        hook: parsed.hook || parsed.summary || flashEntry.content.substring(0, 100),
        keyPoints: parsed.keyPoints || parsed.key_points || [],
        keywords: parsed.keywords || flashEntry.keywords,
        emotionalTone: parsed.emotionalTone || (flashEntry.emotionalSalience > 0.7 ? 'high' : 'normal'),
        linkedTo: flashEntry.linkedTo,
        privacyLevel: flashEntry.privacyLevel,
        compressionMethod: 'ollama-llm'
      };
      
    } catch (e) {
      console.warn('CoreMemories: LLM compression failed, using fallback:', e.message);
      const fallback = new RuleBasedCompression();
      return fallback.compress(flashEntry);
    }
  }
}

// Auto-compression: Chooses best available engine
class AutoCompression {
  constructor() {
    this.ruleEngine = new RuleBasedCompression();
    this.ollamaEngine = null;
  }
  
  async compress(flashEntry) {
    if (CONFIG?.engines?.local?.available) {
      if (!this.ollamaEngine) {
        this.ollamaEngine = new OllamaCompression();
      }
      return await this.ollamaEngine.compress(flashEntry);
    }
    
    return this.ruleEngine.compress(flashEntry);
  }
}

// MEMORY.md Integration
class MemoryMdIntegration {
  constructor() {
    this.pendingUpdates = [];
  }
  
  // Check if entry qualifies for MEMORY.md
  shouldProposeForMemoryMd(entry) {
    if (!CONFIG?.memoryMd?.enabled) return false;
    
    const triggers = CONFIG.memoryMd.updateTriggers;
    
    // High emotional salience (Flash entries have emotionalSalience number)
    if (entry.emotionalSalience !== undefined && entry.emotionalSalience >= triggers.emotionalThreshold) {
      return { reason: 'high_emotion', score: entry.emotionalSalience };
    }
    
    // High emotional tone (Warm entries have emotionalTone string)
    if (entry.emotionalTone === 'high') {
      return { reason: 'high_emotion_tone', tone: entry.emotionalTone };
    }
    
    // Decision type
    if (triggers.decisionTypes.includes(entry.type)) {
      return { reason: 'decision_type', type: entry.type };
    }
    
    // User flagged
    if (triggers.userFlagged && entry.userFlagged) {
      return { reason: 'user_flagged' };
    }
    
    return false;
  }
  
  // Extract essence for MEMORY.md
  extractEssence(entry) {
    if (entry.hook) return entry.hook;
    if (entry.summary) return entry.summary.substring(0, 200);
    return entry.content.substring(0, 200);
  }
  
  // Determine which section to add to
  suggestSection(entry) {
    const sections = CONFIG.memoryMd.sections;
    
    if (entry.type === 'decision') return sections['decision'];
    if (entry.type === 'milestone') return sections['milestone'];
    if (entry.keywords.some(k => ['project', 'product', 'app', 'platform'].includes(k))) {
      return sections['project'];
    }
    if (entry.type === 'learning') return sections['learning'];
    
    return sections['default'];
  }
  
  // Propose update (called during compression)
  proposeUpdate(entry) {
    const check = this.shouldProposeForMemoryMd(entry);
    if (!check) return null;
    
    const proposal = {
      entryId: entry.id,
      timestamp: entry.timestamp,
      essence: this.extractEssence(entry),
      section: this.suggestSection(entry),
      reason: check.reason,
      type: entry.type,
      keywords: entry.keywords
    };
    
    this.pendingUpdates.push(proposal);
    
    // Log to console (in real implementation, this would prompt user)
    console.log('');
    console.log('💡 MEMORY.md Update Suggested:');
    console.log(`   "${proposal.essence}"`);
    console.log(`   Section: ${proposal.section}`);
    console.log(`   Reason: ${proposal.reason}`);
    console.log(`   [Would prompt user: Add to MEMORY.md?]`);
    console.log('');
    
    return proposal;
  }
  
  // Actually update MEMORY.md (called after user approval)
  async updateMemoryMd(proposal) {
    const memoryMdPath = 'MEMORY.md';
    
    if (!fs.existsSync(memoryMdPath)) {
      console.warn('MEMORY.md not found, cannot update');
      return false;
    }
    
    let content = fs.readFileSync(memoryMdPath, 'utf-8');
    
    // Find or create section
    const sectionHeader = proposal.section;
    const entryText = `- **${new Date(proposal.timestamp).toLocaleDateString()}**: ${proposal.essence}`;
    
    if (content.includes(sectionHeader)) {
      // Add to existing section
      const sectionIndex = content.indexOf(sectionHeader);
      const nextSection = content.indexOf('##', sectionIndex + 1);
      const insertIndex = nextSection === -1 ? content.length : nextSection;
      
      content = content.slice(0, insertIndex) + `\n${entryText}\n` + content.slice(insertIndex);
    } else {
      // Create new section at end
      content += `\n${sectionHeader}\n\n${entryText}\n`;
    }
    
    // Backup old version
    const backupPath = `MEMORY.md.backup.${Date.now()}`;
    fs.writeFileSync(backupPath, fs.readFileSync(memoryMdPath));
    
    // Write updated version
    fs.writeFileSync(memoryMdPath, content);
    
    console.log(`✓ MEMORY.md updated: ${proposal.essence.substring(0, 50)}...`);
    return true;
  }
  
  // Get pending proposals
  getPendingUpdates() {
    return this.pendingUpdates;
  }
  
  // Clear pending after processing
  clearPending() {
    this.pendingUpdates = [];
  }
}

// Main CoreMemories class
class CoreMemories {
  constructor(memoryDir = '.openclaw/memory') {
    this.memoryDir = memoryDir;
    this.compressionEngine = new AutoCompression();
    this.memoryMdIntegration = new MemoryMdIntegration();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    await initializeConfig();
    
    const dirs = [
      this.memoryDir,
      path.join(this.memoryDir, 'hot', 'flash'),
      path.join(this.memoryDir, 'hot', 'warm'),
      path.join(this.memoryDir, 'recent', 'week-1'),
      path.join(this.memoryDir, 'recent', 'week-2'),
      path.join(this.memoryDir, 'recent', 'week-3'),
      path.join(this.memoryDir, 'recent', 'week-4'),
      path.join(this.memoryDir, 'archive', 'fresh'),
      path.join(this.memoryDir, 'archive', 'mature'),
      path.join(this.memoryDir, 'archive', 'deep'),
      path.join(this.memoryDir, 'archive', 'core'),
    ];
    dirs.forEach(ensureDir);

    const indexPath = path.join(this.memoryDir, 'index.json');
    if (!fs.existsSync(indexPath)) {
      this.saveIndex({
        keywords: {},
        timestamps: {},
        lastUpdated: getCurrentTimestamp()
      });
    }
    
    this.initialized = true;
  }

  loadIndex() {
    const indexPath = path.join(this.memoryDir, 'index.json');
    const data = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    if (!data.timestamps) data.timestamps = {};
    return data;
  }

  saveIndex(index) {
    index.lastUpdated = getCurrentTimestamp();
    const indexPath = path.join(this.memoryDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }

  updateIndex(entry, location) {
    const index = this.loadIndex();
    
    entry.keywords.forEach(keyword => {
      if (!index.keywords[keyword]) {
        index.keywords[keyword] = [];
      }
      if (!index.keywords[keyword].includes(entry.id)) {
        index.keywords[keyword].push(entry.id);
      }
    });

    index.timestamps[entry.id] = location;
    this.saveIndex(index);
  }

  // Flash layer (0-48h)
  addFlashEntry(content, speaker = 'user', type = 'conversation') {
    const userFlagged = checkUserFlagged(content);
    const emotionalSalience = calculateEmotionalSalience(content);
    
    // Boost salience if user flagged
    const finalSalience = userFlagged ? Math.max(emotionalSalience, 0.85) : emotionalSalience;
    
    const entry = {
      id: generateId(),
      timestamp: getCurrentTimestamp(),
      type,
      content,
      speaker,
      keywords: extractKeywords(content),
      emotionalSalience: finalSalience,
      userFlagged,
      linkedTo: [],
      privacyLevel: 'public'
    };

    const flashPath = path.join(this.memoryDir, 'hot', 'flash', 'current.json');
    let flashData = { entries: [] };
    
    if (fs.existsSync(flashPath)) {
      flashData = JSON.parse(fs.readFileSync(flashPath, 'utf-8'));
    }

    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    flashData.entries = flashData.entries.filter(e => 
      new Date(e.timestamp).getTime() > cutoff
    );

    flashData.entries.push(entry);
    
    if (flashData.entries.length > 15) {
      flashData.entries = flashData.entries.slice(-15);
    }

    fs.writeFileSync(flashPath, JSON.stringify(flashData, null, 2));
    this.updateIndex(entry, 'hot/flash/current.json');

    return entry;
  }

  getFlashEntries() {
    const flashPath = path.join(this.memoryDir, 'hot', 'flash', 'current.json');
    if (!fs.existsSync(flashPath)) return [];
    
    const data = JSON.parse(fs.readFileSync(flashPath, 'utf-8'));
    return data.entries || [];
  }

  // Warm layer with MEMORY.md integration
  async addWarmEntry(flashEntry) {
    // Compress the entry
    const warmEntry = await this.compressionEngine.compress(flashEntry);
    
    // Check if should propose for MEMORY.md
    const proposal = this.memoryMdIntegration.proposeUpdate(warmEntry);
    if (proposal) {
      warmEntry.memoryMdProposal = proposal;
    }
    
    const weekNumber = this.getWeekNumber(new Date(warmEntry.timestamp));
    const warmPath = path.join(this.memoryDir, 'hot', 'warm', `week-${weekNumber}.json`);
    
    let warmData = {
      week: `week-${weekNumber}`,
      entries: []
    };

    if (fs.existsSync(warmPath)) {
      warmData = JSON.parse(fs.readFileSync(warmPath, 'utf-8'));
    }

    warmData.entries.push(warmEntry);
    
    if (warmData.entries.length > 20) {
      warmData.entries = warmData.entries.slice(-20);
    }

    fs.writeFileSync(warmPath, JSON.stringify(warmData, null, 2));
    this.updateIndex(warmEntry, `hot/warm/week-${weekNumber}.json`);
    
    return warmEntry;
  }

  getWarmEntries() {
    const weekNumber = this.getWeekNumber(new Date());
    const warmPath = path.join(this.memoryDir, 'hot', 'warm', `week-${weekNumber}.json`);
    
    if (!fs.existsSync(warmPath)) return [];
    
    const data = JSON.parse(fs.readFileSync(warmPath, 'utf-8'));
    return data.entries || [];
  }

  // Retrieval
  findByKeyword(keyword) {
    const index = this.loadIndex();
    const ids = index.keywords[keyword.toLowerCase()] || [];
    
    const flash = [];
    const warm = [];

    for (const id of ids) {
      const flashEntries = this.getFlashEntries();
      const flashMatch = flashEntries.find(e => e.id === id);
      if (flashMatch) {
        flash.push(flashMatch);
        continue;
      }

      const warmEntries = this.getWarmEntries();
      const warmMatch = warmEntries.find(e => e.id === id);
      if (warmMatch) {
        warm.push(warmMatch);
      }
    }

    return { flash, warm };
  }

  // Session context
  loadSessionContext() {
    const flash = this.getFlashEntries();
    const warm = this.getWarmEntries();
    
    const flashTokens = flash.reduce((sum, e) => sum + Math.ceil(e.content.length / 4), 0);
    const warmTokens = warm.reduce((sum, e) => sum + Math.ceil((e.summary || e.hook || '').length / 4), 0);
    
    return {
      flash,
      warm,
      totalTokens: flashTokens + warmTokens,
      compressionMode: CONFIG?.engines?.local?.available ? 'llm' : 'rules',
      pendingMemoryMdUpdates: this.memoryMdIntegration.getPendingUpdates().length
    };
  }

  // Compression routine with MEMORY.md proposals
  async runCompression() {
    console.log('🔄 CoreMemories: Running compression...');
    
    const flashPath = path.join(this.memoryDir, 'hot', 'flash', 'current.json');
    if (!fs.existsSync(flashPath)) {
      console.log('   No flash entries to compress');
      return;
    }
    
    const flashData = JSON.parse(fs.readFileSync(flashPath, 'utf-8'));
    const now = Date.now();
    const cutoff = now - 48 * 60 * 60 * 1000;
    
    const toCompress = [];
    const toKeep = [];
    
    // Separate old and new entries
    for (const entry of flashData.entries) {
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime < cutoff) {
        toCompress.push(entry);
      } else {
        toKeep.push(entry);
      }
    }
    
    // Compress old entries
    let compressed = 0;
    for (const entry of toCompress) {
      await this.addWarmEntry(entry);
      compressed++;
    }
    
    // Update flash file with only new entries (removes compressed ones)
    fs.writeFileSync(flashPath, JSON.stringify({ entries: toKeep }, null, 2));
    
    console.log(`   ✓ Compressed ${compressed} entries to Warm layer`);
    console.log(`   ✓ Removed compressed entries from Flash`);
    console.log(`   ✓ Flash now has ${toKeep.length} entries`);
    console.log(`   Mode: ${CONFIG?.engines?.local?.available ? 'LLM-enhanced' : 'Rule-based'}`);
    
    // Show pending MEMORY.md updates
    const pending = this.memoryMdIntegration.getPendingUpdates();
    if (pending.length > 0) {
      console.log(`   💡 ${pending.length} entries proposed for MEMORY.md update`);
    }
  }

  // Expert: Approve MEMORY.md update
  async approveMemoryMdUpdate(proposalId) {
    const pending = this.memoryMdIntegration.getPendingUpdates();
    const proposal = pending.find(p => p.entryId === proposalId);
    
    if (!proposal) {
      console.warn('Proposal not found:', proposalId);
      return false;
    }
    
    return await this.memoryMdIntegration.updateMemoryMd(proposal);
  }
  
  // Expert: Get pending MEMORY.md proposals
  getPendingMemoryMdProposals() {
    return this.memoryMdIntegration.getPendingUpdates();
  }

  getWeekNumber(date) {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
  }
  
  getConfig() {
    return CONFIG;
  }
}

// Singleton
let instance = null;

async function getCoreMemories() {
  if (!instance) {
    instance = new CoreMemories();
    await instance.initialize();
  }
  return instance;
}

module.exports = { 
  CoreMemories, 
  getCoreMemories,
  initializeConfig,
  checkOllamaAvailable
};
