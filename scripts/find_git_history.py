import subprocess

out = subprocess.check_output(["git", "log", "-p"], text=True, errors="ignore")
lines = out.splitlines()
for i, line in enumerate(lines):
    if any(k in line.lower() for k in ["entrenching incumbents", "market concentration", "moat", "mitigation framework", "74 +"]):
        print("\n".join(lines[max(0, i-5):min(len(lines), i+6)]))
        print("="*40)
