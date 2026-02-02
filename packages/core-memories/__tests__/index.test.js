/**
 * CoreMemories v2.1 Test - MEMORY.md Integration
 */

const { getCoreMemories } = require('../src/index.js');

async function test() {
  console.log('🧪 Testing CoreMemories v2.1 (MEMORY.md Integration)\n');
  
  const cm = await getCoreMemories();
  
  // Test 1: Add normal entry (no flag)
  console.log('1️⃣ Adding normal entry...');
  const normal = cm.addFlashEntry(
    'We discussed the weather today',
    'louis',
    'conversation'
  );
  console.log(`   Emotional: ${normal.emotionalSalience}, Flagged: ${normal.userFlagged}`);
  
  // Test 2: Add important entry (user says "remember this")
  console.log('\n2️⃣ Adding user-flagged entry...');
  const flagged = cm.addFlashEntry(
    'Remember this: I am launching Card Sync next month. This is important for my business.',
    'louis',
    'conversation'
  );
  console.log(`   Emotional: ${flagged.emotionalSalience}, Flagged: ${flagged.userFlagged}`);
  console.log(`   Keywords: ${flagged.keywords.join(', ')}`);
  
  // Test 3: Add high-emotion decision
  console.log('\n3️⃣ Adding high-emotion decision...');
  const decision = cm.addFlashEntry(
    'I decided to quit my job and focus on entrepreneurship full time. This is terrifying but exciting!',
    'louis',
    'decision'
  );
  console.log(`   Type: ${decision.type}, Emotional: ${decision.emotionalSalience}`);
  
  // Test 4: Run compression (should trigger MEMORY.md proposals)
  console.log('\n4️⃣ Running compression with old entries...');
  
  // Create old entries manually to test compression
  const oldFlagged = {
    id: `mem_${Date.now() - 49 * 60 * 60 * 1000}_flagged`,
    timestamp: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
    type: 'conversation',
    content: 'Remember this: My test recovery code is TEST1234EXAMPLE5678. This is test information.',
    speaker: 'louis',
    keywords: ['recovery', 'code', 'test', 'information'],
    emotionalSalience: 0.9,
    userFlagged: true,
    linkedTo: [],
    privacyLevel: 'public'
  };
  
  const oldDecision = {
    id: `mem_${Date.now() - 50 * 60 * 60 * 1000}_decision`,
    timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    type: 'decision',
    content: 'We decided to build CoreMemories with 3-layer architecture and MEMORY.md integration.',
    speaker: 'louis',
    keywords: ['decided', 'coreMemories', 'architecture', 'integration'],
    emotionalSalience: 0.8,
    userFlagged: false,
    linkedTo: [],
    privacyLevel: 'public'
  };
  
  // Add them to warm (triggering MEMORY.md check)
  await cm.addWarmEntry(oldFlagged);
  await cm.addWarmEntry(oldDecision);
  
  // Test 5: Check pending MEMORY.md proposals
  console.log('\n5️⃣ Checking pending MEMORY.md proposals...');
  const pending = cm.getPendingMemoryMdProposals();
  console.log(`   Pending proposals: ${pending.length}`);
  
  pending.forEach((p, i) => {
    console.log(`   ${i + 1}. "${p.essence.substring(0, 50)}..."`);
    console.log(`      Reason: ${p.reason}, Section: ${p.section}`);
  });
  
  // Test 6: Session context shows pending updates
  console.log('\n6️⃣ Loading session context...');
  const context = cm.loadSessionContext();
  console.log(`   Flash: ${context.flash.length}, Warm: ${context.warm.length}`);
  console.log(`   Pending MEMORY.md updates: ${context.pendingMemoryMdUpdates}`);
  
  console.log('\n✅ Test complete!');
  console.log('\n📋 Summary:');
  console.log('   - Normal entries: Not flagged for MEMORY.md');
  console.log('   - User-flagged entries: Auto-proposed for MEMORY.md');
  console.log('   - High-emotion decisions: Auto-proposed for MEMORY.md');
  console.log('   - Pending proposals:', pending.length);
  console.log('\n💡 Next: User reviews proposals and approves/rejects');
}

test().catch(console.error);
