import { chromium } from 'playwright';

(async () => {
  console.log("Verifying Channels Config Schema Localization...");
  const browser = await chromium.launch({
    args: ['--lang=zh-CN']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    locale: 'zh-CN',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-CN,zh;q=0.9'
    }
  });
  const page = await context.newPage();
  
  const url = "http://127.0.0.1:18789/?token=56bcbb79e3e9db746f863deb08a4fa7e1282cddf31193934#/channels";
  
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const zhTargets = [
    "删除消息",
    "回应",
    "发送消息",
    "贴纸",
    "允许来源",
    "账号",
    "操作",
    "Telegram"
  ];

  let successCount = 0;
  console.log("\nChecking for translated strings:");
  for (const text of zhTargets) {
    const count = await page.getByText(text, { exact: true }).count();
    if (count > 0) {
      console.log(`✅ Found "${text}" - ${count} occurrences`);
      successCount++;
    } else {
      console.log(`❌ "${text}" NOT found`);
    }
  }

  if (successCount === zhTargets.length) {
    console.log("\n✨ Verification PASSED: All targets found.");
  } else {
    console.log(`\n⚠️ Verification FAILED: Found ${successCount}/${zhTargets.length} targets.`);
  }

  await browser.close();
})();
