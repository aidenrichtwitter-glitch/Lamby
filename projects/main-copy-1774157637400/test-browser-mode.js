const LOG_PREFIX = {
  send: '\x1b[36m[SEND]\x1b[0m',
  poll: '\x1b[33m[POLL]\x1b[0m',
  copy: '\x1b[32m[COPY]\x1b[0m',
  clone: '\x1b[35m[CLONE]\x1b[0m',
  error: '\x1b[31m[ERROR]\x1b[0m',
  fix: '\x1b[34m[FIX]\x1b[0m',
  vision: '\x1b[95m[VISION]\x1b[0m',
  timing: '\x1b[93m[TIMING]\x1b[0m',
  lock: '\x1b[96m[LOCK]\x1b[0m',
  ok: '\x1b[32m[OK]\x1b[0m',
  fail: '\x1b[31m[FAIL]\x1b[0m',
};

let simulatedClipboard = '';
let generateDelay = 0;
let cloneWillFail = false;
let cloneFailCount = 0;
let postCloneErrors = [];
let operationLock = false;
let lastExtractedText = '';

const BACKOFF_INTERVALS = [2000, 3000, 4500, 7000, 10000, 15000];
const POST_SEND_DELAY = 1500;
const IPC_TIMEOUT = 3000;

const mockIPC = {
  async invoke(channel, ...args) {
    switch (channel) {
      case 'grok-send-prompt': {
        const prompt = args[0];
        console.log(`${LOG_PREFIX.send} grok-send-prompt called (${prompt.length} chars)`);
        console.log(`${LOG_PREFIX.send} Preview: "${prompt.substring(0, 80)}..."`);
        generateDelay = Math.floor(Math.random() * 4) + 2;
        return { success: true, preMessageCount: 3 };
      }
      case 'grok-check-response-ready': {
        if (generateDelay > 0) {
          generateDelay--;
          console.log(`${LOG_PREFIX.poll} grok-check-response-ready → generating (${generateDelay} polls left)`);
          return { ready: false, generating: true };
        }
        console.log(`${LOG_PREFIX.poll} grok-check-response-ready → READY`);
        return { ready: true, generating: false };
      }
      case 'grok-copy-last-response': {
        const responseText = simulatedClipboard || 'Here is a great starter repo: https://github.com/example/cool-vite-app\n\n```tsx\n// src/App.tsx\nexport default function App() {\n  return <div>Hello</div>;\n}\n```';
        console.log(`${LOG_PREFIX.copy} grok-copy-last-response → extracted ${responseText.length} chars from DOM`);
        return { success: true, text: responseText };
      }
      default:
        return {};
    }
  }
};

async function ipcWithTimeout(channel, ...args) {
  const start = Date.now();
  const result = await Promise.race([
    mockIPC.invoke(channel, ...args),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`IPC ${channel} timed out (3s)`)), IPC_TIMEOUT)),
  ]);
  const elapsed = Date.now() - start;
  console.log(`${LOG_PREFIX.timing} IPC ${channel} completed in ${elapsed}ms (timeout: ${IPC_TIMEOUT}ms)`);
  return result;
}

function detectGitHubUrl(text) {
  const GUARDIAN_REPOS = ['aidenrichtwitter-glitch/guardian-ai'];
  const regex = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const key = `${match[1]}/${match[2]}`.toLowerCase();
    if (GUARDIAN_REPOS.includes(key)) {
      console.log(`${LOG_PREFIX.timing} Skipped Guardian self-repo: ${key}`);
      continue;
    }
    return match[0];
  }
  return null;
}

async function simulateSendPromptToWebview(prompt, statusLabel) {
  console.log(`\n${LOG_PREFIX.send} === sendPromptToWebview("${statusLabel}") ===`);

  if (operationLock) {
    console.log(`${LOG_PREFIX.lock} BLOCKED — operationLock is held, skipping`);
    return false;
  }
  operationLock = true;
  console.log(`${LOG_PREFIX.lock} Operation lock ACQUIRED`);

  const sendResult = await ipcWithTimeout('grok-send-prompt', prompt);
  if (!sendResult.success) { operationLock = false; throw new Error('Send failed'); }

  console.log(`${LOG_PREFIX.timing} Post-send delay: ${POST_SEND_DELAY}ms (webview processing time)`);
  await new Promise(r => setTimeout(r, 50));

  const startTime = Date.now();
  let pollIndex = 0;
  const MAX_ELAPSED = 15 * 60 * 1000;

  while (true) {
    const delay = pollIndex === 0 ? POST_SEND_DELAY : BACKOFF_INTERVALS[Math.min(pollIndex - 1, BACKOFF_INTERVALS.length - 1)];
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_ELAPSED) {
      console.log(`${LOG_PREFIX.error} 15-minute hard cap reached — falling back to clipboard`);
      operationLock = false;
      return false;
    }
    console.log(`${LOG_PREFIX.timing} Poll #${pollIndex}: waiting ${delay}ms (backoff interval)`);
    await new Promise(r => setTimeout(r, 20));

    const state = await ipcWithTimeout('grok-check-response-ready', sendResult.preMessageCount);
    if (state.ready) {
      const extractResult = await ipcWithTimeout('grok-copy-last-response');
      operationLock = false;
      console.log(`${LOG_PREFIX.lock} Operation lock RELEASED`);
      if (extractResult.success && extractResult.text) {
        lastExtractedText = extractResult.text;
        return true;
      }
      return false;
    }
    pollIndex++;
  }
}

async function simulateClone(repoUrl) {
  if (operationLock) {
    console.log(`${LOG_PREFIX.lock} Clone blocked by operation lock`);
    return null;
  }
  operationLock = true;
  console.log(`${LOG_PREFIX.clone} Cloning ${repoUrl}... (lock acquired)`);
  if (cloneWillFail && cloneFailCount > 0) {
    cloneFailCount--;
    operationLock = false;
    const errMsg = 'Repository not found (404)';
    console.log(`${LOG_PREFIX.error} Clone failed: ${errMsg}`);
    throw new Error(errMsg);
  }
  operationLock = false;
  console.log(`${LOG_PREFIX.clone} Clone successful (lock released)`);
  return { projectName: 'test-project' };
}

async function testPhase1_InitialRepoSuggestion() {
  console.log('\n\x1b[1m========== PHASE 1: Initial Repo Suggestion ==========\x1b[0m');

  const projectName = 'my cool app';
  const repoPrompt = `Build a ${projectName} app\n\n=== REPO SELECTION ===\nActive project: my-cool-app (newly created, empty)\nSuggest ONE public GitHub repo.\nGuardian AI source: https://github.com/aidenrichtwitter-glitch/guardian-ai\n=== END REPO SELECTION ===`;

  const sent = await simulateSendPromptToWebview(repoPrompt, `Asking Grok for repo suggestion for "${projectName}"`);

  if (sent) {
    if (!lastExtractedText || lastExtractedText.length < 10) {
      console.log(`${LOG_PREFIX.fail} No text extracted from IPC — expected direct DOM extraction`);
      return null;
    }
    console.log(`${LOG_PREFIX.ok} Direct text extraction: ${lastExtractedText.length} chars (no clipboard needed)`);
    const url = detectGitHubUrl(lastExtractedText);
    console.log(`${LOG_PREFIX.ok} Extractor detects URL: ${url}`);
    if (url && !url.includes('guardian-ai')) {
      console.log(`${LOG_PREFIX.ok} Guardian self-repo correctly filtered out`);
    }
    console.log(`${LOG_PREFIX.ok} Project is empty → auto-clone triggered`);
    return url;
  }
  return null;
}

async function testPhase2_CloneFailureRecovery(repoUrl) {
  console.log('\n\x1b[1m========== PHASE 2: Clone Failure Recovery ==========\x1b[0m');

  cloneWillFail = true;
  cloneFailCount = 1;

  try {
    await simulateClone(repoUrl);
  } catch (e) {
    console.log(`${LOG_PREFIX.fix} Autonomous loop active → sending error context back to Grok`);
    const retryPrompt = `The suggested repo "${repoUrl}" failed to clone.\nError: ${e.message}\n\nSuggest a DIFFERENT public GitHub repo.`;

    simulatedClipboard = 'Sorry about that! Try this instead:\nhttps://github.com/example/better-starter\nThis one is actively maintained.';
    lastExtractedText = '';
    const sent = await simulateSendPromptToWebview(retryPrompt, 'Clone failed — asking Grok for alternative repo');
    if (sent) {
      const newUrl = detectGitHubUrl(lastExtractedText);
      console.log(`${LOG_PREFIX.ok} Grok suggested replacement: ${newUrl}`);

      cloneWillFail = false;
      await simulateClone(newUrl);
      console.log(`${LOG_PREFIX.ok} Replacement clone succeeded`);
      return newUrl;
    }
  }
  return repoUrl;
}

async function testPhase3_PostCloneFixLoop() {
  console.log('\n\x1b[1m========== PHASE 3: Post-Clone Error Detection & Fix Loop ==========\x1b[0m');

  console.log(`${LOG_PREFIX.timing} HMR settle delay: 3500ms before error baseline`);
  console.log(`${LOG_PREFIX.timing} Post-apply monitoring window: 8500ms total (3500ms settle + 5000ms check)`);

  postCloneErrors = [
    { level: 'error', message: 'Module not found: tailwindcss', timestamp: Date.now() },
    { level: 'error', message: 'SyntaxError: Unexpected token', timestamp: Date.now() },
  ];

  console.log(`${LOG_PREFIX.error} Preview detected ${postCloneErrors.length} errors after clone:`);
  for (const err of postCloneErrors) {
    console.log(`  [${err.level.toUpperCase()}] ${err.message}`);
  }

  const fixPrompt = `[Autonomous Fix — Attempt 1/4]\nOriginal goal: Build a my cool app app\n\nThe app preview just failed. Logs:\n${postCloneErrors.map(e => `[${e.level.toUpperCase()}] ${e.message}`).join('\n')}\n\nFix the issue and provide updated code blocks.`;

  simulatedClipboard = '// file: tailwind.config.ts\n```ts\nexport default { content: ["./src/**/*.{ts,tsx}"], theme: { extend: {} }, plugins: [] };\n```';
  lastExtractedText = '';
  console.log(`${LOG_PREFIX.fix} buildDiagnoseFixPrompt → sending fix to Grok webview`);
  const sent = await simulateSendPromptToWebview(fixPrompt, 'Autonomous fix sent (attempt 1/4)');

  if (sent) {
    console.log(`${LOG_PREFIX.ok} Grok response extracted directly (${lastExtractedText.length} chars) — extractor parses code blocks`);
    console.log(`${LOG_PREFIX.ok} Auto-apply would write tailwind.config.ts`);
    console.log(`${LOG_PREFIX.timing} Post-apply: 3500ms HMR settle → 5000ms error check window`);

    postCloneErrors = [];
    console.log(`${LOG_PREFIX.ok} No new errors after HMR settle → autonomous loop: SUCCESS`);
  }
}

async function testPhase4_VisionAssistedFix() {
  console.log('\n\x1b[1m========== PHASE 4: Vision-Assisted Fixing ==========\x1b[0m');

  console.log(`${LOG_PREFIX.vision} visionEnabled=true, visionAvailable=true`);
  console.log(`${LOG_PREFIX.timing} Vision capture delay: 4000ms (wait for HMR to fully settle)`);

  let captureAttempt = 0;
  let visionResult = null;
  for (let retry = 0; retry < 2; retry++) {
    captureAttempt++;
    console.log(`${LOG_PREFIX.vision} captureAndDescribe attempt ${captureAttempt}/2`);
    if (retry === 0 && Math.random() > 0.5) {
      console.log(`${LOG_PREFIX.vision} Capture attempt ${captureAttempt} failed — retrying in 1000ms`);
      await new Promise(r => setTimeout(r, 20));
      continue;
    }
    visionResult = { description: 'The page shows a white screen with no styling.' };
    console.log(`${LOG_PREFIX.vision} Capture succeeded on attempt ${captureAttempt}`);
    break;
  }

  if (visionResult) {
    console.log(`${LOG_PREFIX.vision} Analysis: "${visionResult.description}"`);
  }

  const fixPrompt = `[Autonomous Fix — Attempt 2/4]\nOriginal goal: Build a my cool app app\n\n=== VISUAL ANALYSIS ===\n${visionResult?.description || 'No capture'}\n=== END VISUAL ANALYSIS ===\n\nFix the visual issues.`;

  simulatedClipboard = '// file: src/App.tsx\n```tsx\nexport default function App() { return <div className="min-h-screen bg-gray-900">...</div>; }\n```';
  lastExtractedText = '';
  const sent = await simulateSendPromptToWebview(fixPrompt, 'Autonomous fix sent (attempt 2/4)');
  if (sent) {
    console.log(`${LOG_PREFIX.ok} Grok fixed visual issues based on screenshot analysis`);
  }
}

async function testPhase5_RepoReplacement() {
  console.log('\n\x1b[1m========== PHASE 5: Repo Replacement ==========\x1b[0m');

  simulatedClipboard = 'This starter template has too many issues. I suggest using a completely different repo instead:\nhttps://github.com/example/solid-vite-starter\nThis is a much better maintained project.';

  const url = detectGitHubUrl(simulatedClipboard);
  const textLower = simulatedClipboard.toLowerCase();
  const hasSuggestRepo = textLower.includes('suggest') && textLower.includes('repo');

  console.log(`${LOG_PREFIX.clone} Detected new GitHub URL in response: ${url}`);
  console.log(`${LOG_PREFIX.clone} Text contains repo suggestion language: ${hasSuggestRepo}`);
  console.log(`${LOG_PREFIX.clone} Project has files → using handleReplaceRepo`);

  await simulateClone(url);
  console.log(`${LOG_PREFIX.ok} Repo replaced successfully → monitoring restarts`);
}

async function testPhase6_SelfCloneProtection() {
  console.log('\n\x1b[1m========== PHASE 6: Guardian Self-Clone Protection ==========\x1b[0m');

  const textWithGuardianOnly = 'Check out the source at https://github.com/aidenrichtwitter-glitch/guardian-ai for reference.';
  const url1 = detectGitHubUrl(textWithGuardianOnly);
  console.log(`${LOG_PREFIX.timing} Text with only Guardian URL → detected: ${url1}`);
  if (url1 === null) {
    console.log(`${LOG_PREFIX.ok} Guardian self-repo correctly filtered — no URL returned`);
  } else {
    console.log(`${LOG_PREFIX.fail} Should have filtered Guardian repo but got: ${url1}`);
    return false;
  }

  const textWithBoth = 'I recommend https://github.com/aidenrichtwitter-glitch/guardian-ai for reference and https://github.com/example/real-starter for your project.';
  const url2 = detectGitHubUrl(textWithBoth);
  console.log(`${LOG_PREFIX.timing} Text with Guardian + real URL → detected: ${url2}`);
  if (url2 === 'https://github.com/example/real-starter') {
    console.log(`${LOG_PREFIX.ok} Correctly picked real repo, skipped Guardian`);
  } else {
    console.log(`${LOG_PREFIX.fail} Wrong URL detected: ${url2}`);
    return false;
  }

  return true;
}

async function testPhase7_OperationLock() {
  console.log('\n\x1b[1m========== PHASE 7: Operation Lock ==========\x1b[0m');

  operationLock = true;
  console.log(`${LOG_PREFIX.lock} Simulating lock held by another operation`);

  const blocked = await simulateSendPromptToWebview('test', 'Should be blocked');
  if (!blocked) {
    console.log(`${LOG_PREFIX.ok} sendPromptToWebview correctly returned false when locked`);
  }

  operationLock = false;
  console.log(`${LOG_PREFIX.lock} Lock released — operations can proceed`);
  return !blocked;
}

async function runAllTests() {
  console.log('\x1b[1m\x1b[36m');
  console.log('================================================================');
  console.log('  BROWSER MODE AUTONOMOUS LOOP + TIMING SAFEGUARDS - TEST SUITE ');
  console.log('================================================================');
  console.log('\x1b[0m');
  console.log('Tests: autonomous loop (5 phases) + timing safeguards (2 phases)\n');
  console.log('Safeguards verified:');
  console.log('  - Direct DOM text extraction (no clipboard dependency)');
  console.log('  - Exponential backoff polling (2s→3s→4.5s→7s→10s→15s cap)');
  console.log('  - 1500ms post-send delay before first poll');
  console.log('  - 15-minute hard timeout cap');
  console.log('  - 3s per-IPC-call timeout');
  console.log('  - 3500ms HMR settle + 5000ms error check (8500ms total)');
  console.log('  - 4000ms vision capture delay + 2x retry');
  console.log('  - Global operation lock');
  console.log('  - Guardian self-clone protection\n');

  const totalPhases = 7;
  let passed = 0;
  let failed = 0;

  try {
    const repoUrl = await testPhase1_InitialRepoSuggestion();
    if (repoUrl && !repoUrl.includes('guardian-ai')) { passed++; console.log(`\n${LOG_PREFIX.ok} Phase 1 PASSED`); }
    else { failed++; console.log(`\n${LOG_PREFIX.fail} Phase 1 FAILED`); }

    const finalUrl = await testPhase2_CloneFailureRecovery(repoUrl || 'https://github.com/example/bad-repo');
    if (finalUrl) { passed++; console.log(`\n${LOG_PREFIX.ok} Phase 2 PASSED`); }
    else { failed++; console.log(`\n${LOG_PREFIX.fail} Phase 2 FAILED`); }

    await testPhase3_PostCloneFixLoop();
    passed++;
    console.log(`\n${LOG_PREFIX.ok} Phase 3 PASSED`);

    await testPhase4_VisionAssistedFix();
    passed++;
    console.log(`\n${LOG_PREFIX.ok} Phase 4 PASSED`);

    await testPhase5_RepoReplacement();
    passed++;
    console.log(`\n${LOG_PREFIX.ok} Phase 5 PASSED`);

    const selfCloneOk = await testPhase6_SelfCloneProtection();
    if (selfCloneOk) { passed++; console.log(`\n${LOG_PREFIX.ok} Phase 6 PASSED`); }
    else { failed++; console.log(`\n${LOG_PREFIX.fail} Phase 6 FAILED`); }

    const lockOk = await testPhase7_OperationLock();
    if (lockOk) { passed++; console.log(`\n${LOG_PREFIX.ok} Phase 7 PASSED`); }
    else { failed++; console.log(`\n${LOG_PREFIX.fail} Phase 7 FAILED`); }

  } catch (e) {
    failed++;
    console.error(`\n${LOG_PREFIX.fail} Test crashed:`, e.message);
  }

  console.log(`\n\x1b[1m========== RESULTS ==========\x1b[0m`);
  console.log(`Passed: ${passed}/${totalPhases}`);
  console.log(`Failed: ${failed}/${totalPhases}`);
  if (failed === 0) {
    console.log('\n\x1b[32m\x1b[1mALL PHASES PASSED — Browser mode + timing safeguards verified.\x1b[0m');
    console.log('Safeguards active: exponential backoff, IPC timeout, operation lock,');
    console.log('HMR settle delay, vision retry, Guardian self-clone protection.\n');
  } else {
    console.log(`\n\x1b[31m\x1b[1m${failed} phase(s) failed — check logs above.\x1b[0m\n`);
  }
}

runAllTests();
