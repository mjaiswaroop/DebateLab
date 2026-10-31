import os
import sys

fragments = [
    "moat", "incumbent", "compliance cost", "market concentration",
    "mitigation framework", "statutory", "institutional feasibility",
    "final clash", "enforcement", "74", "base_score", "heuristic",
    "offline", "fallback"
]

root = r"c:\Users\jaisw\OneDrive\Desktop\PROJECTS\COLLEGE\DebateLab"
exclude_dirs = {".next", ".git", "node_modules", "venv", "__pycache__", ".pytest_cache", ".vscode"}

results = {f: [] for f in fragments}

for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in exclude_dirs and not d.endswith(".egg-info")]
    for fname in filenames:
        if fname.endswith((".db", ".pyc", ".png", ".jpg", ".ico", ".woff", ".woff2", ".ttf", ".tsbuildinfo")):
            continue
        fpath = os.path.join(dirpath, fname)
        relpath = os.path.relpath(fpath, root)
        if relpath.startswith("scripts"):
            continue
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                for line_no, line in enumerate(f, 1):
                    lower_line = line.lower()
                    for frag in fragments:
                        if frag in lower_line:
                            results[frag].append((relpath, line_no, line.strip()))
        except Exception:
            pass

with open(r"c:\Users\jaisw\OneDrive\Desktop\PROJECTS\COLLEGE\DebateLab\scripts\fragment_results.txt", "w", encoding="utf-8") as out:
    for frag in fragments:
        out.write(f"=== FRAGMENT: '{frag}' ({len(results[frag])} matches) ===\n")
        for relpath, line_no, line in results[frag]:
            out.write(f"  {relpath}:{line_no}: {line}\n")
        out.write("\n")
