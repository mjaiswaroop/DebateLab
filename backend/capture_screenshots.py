import os
import subprocess
import time

chrome_paths = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Users\jaisw\AppData\Local\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

browser = None
for p in chrome_paths:
    if os.path.exists(p):
        browser = p
        break

print(f"Found browser: {browser}")

out_dir = r"C:\Users\jaisw\.gemini\antigravity-ide\brain\d9039d8f-4b73-4dfb-aa7a-ce5dd13daaad"
os.makedirs(out_dir, exist_ok=True)

# 1280px screenshot
shot_1280 = os.path.join(out_dir, "cricket_debate_1280px.png")
cmd_1280 = [
    browser,
    "--headless=new",
    "--disable-gpu",
    "--window-size=1280,900",
    f"--screenshot={shot_1280}",
    "http://localhost:3001/arena?mode=chat",
]
print("Capturing 1280px...")
subprocess.run(cmd_1280, check=False)
print("1280px captured:", os.path.exists(shot_1280), shot_1280)

# 390px mobile screenshot
shot_390 = os.path.join(out_dir, "cricket_debate_390px.png")
cmd_390 = [
    browser,
    "--headless=new",
    "--disable-gpu",
    "--window-size=390,844",
    f"--screenshot={shot_390}",
    "http://localhost:3001/arena?mode=chat",
]
print("Capturing 390px...")
subprocess.run(cmd_390, check=False)
print("390px captured:", os.path.exists(shot_390), shot_390)
