import os
import sys
sys.stdout.reconfigure(encoding="utf-8")

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
        if fname.endswith((".db", ".pyc", ".png", ".jpg", ".ico", ".woff", ".woff2", ".ttf")):
            continue
        fpath = os.path.join(dirpath, fname)
        relpath = os.path.relpath(fpath, root)
        if relpath == os.path.join("scripts", "search_fragments.py"):
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

for frag in fragments:
    print(f"=== FRAGMENT: '{frag}' ({len(results[frag])} matches) ===")
    for relpath, line_no, line in results[frag]:
        print(f"  {relpath}:{line_no}: {line[:140]}")
    print()
