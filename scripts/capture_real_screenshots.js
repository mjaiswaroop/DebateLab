const path = require("path");
const fs = require("fs");

// Resolve playwright from frontend/node_modules if executed from repo root
let chromium;
try {
  chromium = require("playwright").chromium;
} catch {
  const frontendPlaywrightPath = path.resolve(__dirname, "..", "frontend", "node_modules", "playwright");
  chromium = require(frontendPlaywrightPath).chromium;
}

async function run() {
  const repoRoot = path.resolve(__dirname, "..");
  const docsDir = path.join(repoRoot, "docs", "screenshots");
  const artifactDir = "C:\\Users\\jaisw\\.gemini\\antigravity-ide\\brain\\d9039d8f-4b73-4dfb-aa7a-ce5dd13daaad";

  fs.mkdirSync(docsDir, { recursive: true });
  fs.mkdirSync(artifactDir, { recursive: true });

  const log = (msg) => {
    console.log(msg);
  };

  const browserPaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe")
  ];

  let executablePath = browserPaths.find(p => fs.existsSync(p));
  log("Using browser binary at: " + executablePath);

  const browser = await chromium.launch({
    executablePath: executablePath || undefined,
    headless: true,
    args: [
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-cache",
      "--disable-application-cache",
      "--disk-cache-size=0",
    ],
  });

  try {
    // =============================================================
    // STATE A: Demo Mode (No Key) - In Active Sparring Session
    // =============================================================
    log("Capturing State A: Demo Mode (No Key)...");
    const demoContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }
    });
    const demoPage = await demoContext.newPage();

    const demoSessionData = {
      topic: "virat kholi is the goat in cricket",
      customInput: "virat kholi is the goat in cricket",
      userSide: "government",
      difficulty: "intermediate",
      messages: [
        {
          id: "intro-msg",
          speaker: "opponent",
          text: "I'll take the Opposition on: \"Virat kholi is the goat in cricket\". You represent the Government / Affirmative. Deliver your opening argument to begin the sparring round.",
          poi: "What is your primary evidentiary standard for asserting this on \"Virat kholi is the goat in cricket\"?",
          timestamp: "10:30 AM"
        },
        {
          id: "user-msg-1",
          speaker: "user",
          text: "Kohli has dominated across formats with unmatched run chasing records in cricket.",
          score: null,
          timestamp: "10:31 AM"
        },
        {
          id: "opp-msg-1",
          speaker: "opponent",
          text: "Regarding the motion \"virat kholi is the goat in cricket\": you claim that \"Kohli has dominated across formats with unmatched run chasing records in cricket\", but simply asserting this does not demonstrate why it satisfies the necessary standard or overcomes competing criteria. What comparative benchmark validates this position over alternatives?",
          poi: "Point of Information: What concrete comparative metric validates this claim over rival arguments in cricket?",
          timestamp: "10:31 AM",
          is_demo: true,
          demo_reason: "Offline fallback mode"
        }
      ],
      exchangeCount: 1,
      secondsElapsed: 45,
      hasDemoActive: true,
      activeDemoReason: "Offline fallback mode"
    };

    await demoPage.addInitScript((sessionJson) => {
      localStorage.clear();
      localStorage.setItem("cross_ex_endless_session", sessionJson);
    }, JSON.stringify(demoSessionData));

    await demoPage.goto("http://127.0.0.1:3001/arena?mode=chat&_cb=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await demoPage.waitForTimeout(3000);

    // Capture 1280px Demo
    const demo1280Path = path.join(docsDir, "demo_1280px.png");
    await demoPage.screenshot({ path: demo1280Path, fullPage: false });
    fs.copyFileSync(demo1280Path, path.join(artifactDir, "demo_1280px.png"));
    log("Saved demo_1280px.png");

    // Capture 390px Demo
    await demoPage.setViewportSize({ width: 390, height: 844 });
    await demoPage.waitForTimeout(1000);
    const demo390Path = path.join(docsDir, "demo_390px.png");
    await demoPage.screenshot({ path: demo390Path, fullPage: false });
    fs.copyFileSync(demo390Path, path.join(artifactDir, "demo_390px.png"));
    log("Saved demo_390px.png");

    await demoContext.close();

    // =============================================================
    // STATE B: Mocked Live Mode (With Key) - In Active Sparring Session
    // =============================================================
    log("Capturing State B: Mocked Live Mode (With Key)...");
    const liveContext = await browser.newContext({
      viewport: { width: 1280, height: 900 }
    });
    const livePage = await liveContext.newPage();

    const liveSessionData = {
      topic: "virat kholi is the goat in cricket",
      customInput: "virat kholi is the goat in cricket",
      userSide: "government",
      difficulty: "intermediate",
      messages: [
        {
          id: "intro-msg",
          speaker: "opponent",
          text: "I'll take the Opposition on: \"Virat kholi is the goat in cricket\". You represent the Government / Affirmative. Deliver your opening argument to begin the sparring round.",
          poi: "What is your primary evidentiary standard for asserting this on \"Virat kholi is the goat in cricket\"?",
          timestamp: "10:30 AM"
        },
        {
          id: "user-msg-1",
          speaker: "user",
          text: "Kohli has dominated across formats with unmatched run chasing records in cricket.",
          score: 78,
          coaching_tip: "Strengthen your warrant by isolating Kohli's away-test averages against top pace attacks in swinging conditions.",
          timestamp: "10:31 AM"
        },
        {
          id: "opp-msg-1",
          speaker: "opponent",
          text: "While Kohli has dominated across cricket formats with extraordinary batting records, Don Bradman's test average of 99.94 and Sachin Tendulkar's longevity against all-time bowling attacks present a compelling counter-case.",
          poi: "Point of Information: How do you account for era-adjusted bowling averages when evaluating batting dominance?",
          timestamp: "10:31 AM",
          is_demo: false
        }
      ],
      exchangeCount: 1,
      secondsElapsed: 72,
      hasDemoActive: false,
      activeDemoReason: ""
    };

    await livePage.addInitScript((sessionJson) => {
      localStorage.clear();
      localStorage.setItem("cross_ex_gemini_api_key", "AIzaSyLiveDemoKeyConfiguredForDebateLab992");
      localStorage.setItem("cross_ex_endless_session", sessionJson);
    }, JSON.stringify(liveSessionData));

    await livePage.goto("http://127.0.0.1:3001/arena?mode=chat&_cb=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 20000 });
    await livePage.waitForTimeout(3000);

    // Capture 1280px Mocked Live
    const live1280Path = path.join(docsDir, "live_1280px.png");
    await livePage.screenshot({ path: live1280Path, fullPage: false });
    fs.copyFileSync(live1280Path, path.join(artifactDir, "live_1280px.png"));
    log("Saved live_1280px.png (mocked live response)");

    // Capture 390px Mocked Live
    await livePage.setViewportSize({ width: 390, height: 844 });
    await livePage.waitForTimeout(1000);
    const live390Path = path.join(docsDir, "live_390px.png");
    await livePage.screenshot({ path: live390Path, fullPage: false });
    fs.copyFileSync(live390Path, path.join(artifactDir, "live_390px.png"));
    log("Saved live_390px.png (mocked live response)");

    await liveContext.close();

    log("SUCCESS: All 4 real screenshots captured via Playwright!");
  } catch (err) {
    log("ERROR IN RUN: " + (err.stack || err.message));
  } finally {
    if (browser) await browser.close();
  }
}

run().catch((err) => {
  console.error("FATAL: " + (err.stack || err.message));
  process.exit(1);
});
