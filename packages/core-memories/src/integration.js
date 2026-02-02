/**
 * CoreMemories Integration Layer
 * Connects CoreMemories with CRON, HEARTBEAT, and reminders
 */

const { getCoreMemories } = require('./index.js');

/**
 * HEARTBEAT Integration
 * Called every 6 hours to maintain CoreMemories
 */
async function heartbeatMaintenance() {
  console.log('💓 HEARTBEAT: Running CoreMemories maintenance...');
  
  const cm = await getCoreMemories();
  
  // 1. Run compression (Flash → Warm)
  await cm.runCompression();
  
  // 2. Get pending MEMORY.md proposals
  const pending = cm.getPendingMemoryMdProposals();
  if (pending.length > 0) {
    console.log(`   💡 ${pending.length} MEMORY.md updates pending approval`);
    // In real implementation, this would notify user
  }
  
  // 3. Log status
  const context = cm.loadSessionContext();
  console.log(`   📊 Status: ${context.flash.length} flash, ${context.warm.length} warm entries`);
  
  return {
    compressed: true,
    pendingMemoryMdUpdates: pending.length,
    totalTokens: context.totalTokens
  };
}

/**
 * CRON Integration
 * Creates a reminder with CoreMemories context
 */
async function createSmartReminder(params) {
  const { text, scheduledTime, keywords = [] } = params;
  
  console.log(`⏰ CRON: Creating smart reminder for ${scheduledTime}`);
  
  // Query CoreMemories for context
  const cm = await getCoreMemories();
  let contextEntries = [];
  
  // Search by keywords
  for (const keyword of keywords) {
    const results = cm.findByKeyword(keyword);
    contextEntries.push(...results.flash, ...results.warm);
  }
  
  // Deduplicate
  contextEntries = [...new Map(contextEntries.map(e => [e.id, e])).values()];
  
  // Build context summary
  const context = contextEntries.slice(0, 3).map(e => {
    if (e.content) return e.content.substring(0, 100);
    if (e.summary) return e.summary;
    if (e.hook) return e.hook;
    return '';
  }).filter(Boolean);
  
  const reminderWithContext = {
    text,
    scheduledTime,
    keywords,
    context: context.length > 0 ? context : null,
    createdAt: new Date().toISOString()
  };
  
  console.log(`   📝 Reminder created with ${context.length} context entries`);
  
  return reminderWithContext;
}

/**
 * Execute a reminder with CoreMemories context
 * Called by CRON when reminder fires
 */
async function executeSmartReminder(reminder) {
  console.log('🔔 Executing smart reminder...');
  
  let message = `⏰ Reminder: ${reminder.text}`;
  
  // Add context if available
  if (reminder.context && reminder.context.length > 0) {
    message += '\n\n📋 Context:';
    reminder.context.forEach((ctx, i) => {
      message += `\n  ${i + 1}. ${ctx}...`;
    });
  }
  
  // Add related keywords for further lookup
  if (reminder.keywords && reminder.keywords.length > 0) {
    message += `\n\n🔍 Related: ${reminder.keywords.join(', ')}`;
  }
  
  console.log(message);
  return message;
}

/**
 * Store a task with CoreMemories
 * Links the task to relevant memories
 */
async function storeTaskWithContext(task) {
  const cm = await getCoreMemories();
  
  // Extract keywords from task
  const keywords = task.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4);
  
  // Find related memories
  const relatedMemories = [];
  for (const keyword of keywords.slice(0, 3)) {
    const results = cm.findByKeyword(keyword);
    if (results.flash.length > 0 || results.warm.length > 0) {
      relatedMemories.push({
        keyword,
        flash: results.flash.length,
        warm: results.warm.length
      });
    }
  }
  
  const taskEntry = {
    id: `task_${Date.now()}`,
    type: 'task',
    content: task,
    keywords,
    relatedMemories,
    createdAt: new Date().toISOString()
  };
  
  // Store in CoreMemories
  cm.addFlashEntry(
    `Task created: ${task}`,
    'user',
    'action'
  );
  
  console.log(`✅ Task stored with ${relatedMemories.length} related memory links`);
  
  return taskEntry;
}

/**
 * Complete workflow example
 */
async function exampleWorkflow() {
  console.log('\n🔄 Example: Complete Workflow\n');
  
  // 1. User creates a reminder
  console.log('1. User: "Remind me to check Groq in 2 hours"');
  const reminder = await createSmartReminder({
    text: 'Check Groq console status',
    scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    keywords: ['groq', 'voice', 'console']
  });
  
  // 2. Store the task
  console.log('\n2. Storing task with context...');
  await storeTaskWithContext('Check Groq console for voice system');
  
  // 3. HEARTBEAT runs (every 6h)
  console.log('\n3. HEARTBEAT running maintenance...');
  await heartbeatMaintenance();
  
  // 4. CRON fires reminder
  console.log('\n4. CRON firing reminder...');
  const reminderMessage = await executeSmartReminder(reminder);
  
  console.log('\n✅ Workflow complete!');
  console.log('\nReminder message that would be sent:');
  console.log('─'.repeat(50));
  console.log(reminderMessage);
  console.log('─'.repeat(50));
}

// Export integration functions
module.exports = {
  heartbeatMaintenance,
  createSmartReminder,
  executeSmartReminder,
  storeTaskWithContext,
  exampleWorkflow
};

// If run directly, show example
if (require.main === module) {
  exampleWorkflow().catch(console.error);
}
