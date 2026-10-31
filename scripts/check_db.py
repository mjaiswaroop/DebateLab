import sqlite3

conn = sqlite3.connect("backend/debatelab.db")
cursor = conn.cursor()
tables = [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("Tables:", tables)

keywords = ["moat", "incumbent", "compliance", "market concentration", "mitigation framework", "statutory", "final clash", "74"]
for t in tables:
    count = 0
    for row in cursor.execute(f"SELECT * FROM {t}").fetchall():
        row_str = str(row).lower()
        for kw in keywords:
            if kw in row_str:
                print(f"Match in {t} for '{kw}': {str(row)[:160]}")
                count += 1
                if count > 5:
                    break
