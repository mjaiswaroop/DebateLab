const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function traceClick() {
  const browserPaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
  ];

  const executablePath = browserPaths.find((p) => fs.existsSync(p));
  console.log("Using browser at:", executablePath);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const networkLogs = [];

  page.on("request", (req) => {
    if (req.url().includes("/api/")) {
      networkLogs.push({
        type: "request",
        url: req.url(),
        method: req.method(),
        postData: req.postData(),
        headers: req.headers(),
      });
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("/api/")) {
      let body = null;
      try {
        body = await res.json();
      } catch {
        try {
          body = await res.text();
        } catch {}
      }
      networkLogs.push({
        type: "response",
        url: res.url(),
        status: res.status(),
        headers: res.headers(),
        body,
      });
    }
  });

  console.log("Navigating to http://127.0.0.1:3001/arena?mode=chat...");
  await page.goto("http://127.0.0.1:3001/arena?mode=chat", { waitUntil: "networkidle" });

  // Clear any existing localStorage to guarantee no cached session or keys
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  console.log("Setting up debate on 'Virat kholi is the goat in cricket'...");
  const inputTopic = page.locator('input[placeholder*="virat kholi"]').first();
  await inputTopic.waitFor({ state: "visible", timeout: 10000 });
  await inputTopic.fill("Virat kholi is the goat in cricket");

  const startBtn = page.locator('button:has-text("Start Debate With This Topic")');
  await startBtn.click();

  // Wait for speech input bar to appear
  const speechInput = page.locator("textarea").first();
  await speechInput.waitFor({ state: "visible", timeout: 10000 });

  console.log("Typing user argument: 'he has the most number of odi centuries'...");
  await speechInput.fill("he has the most number of odi centuries");

  console.log("Submitting turn via Enter...");
  await speechInput.press("Enter");

  // Wait for opponent response to arrive
  console.log("Waiting for network response...");
  await page.waitForTimeout(6000);

  console.log("\n=== NETWORK TRACE RESULTS ===");
  console.log(JSON.stringify(networkLogs, null, 2));

  await browser.close();
}

traceClick().catch((err) => {
  console.error("TRACE ERROR:", err);
  process.exit(1);
});
