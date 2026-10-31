import sqlite3

conn = sqlite3.connect("backend/debatelab.db")
c = conn.cursor()
row = c.execute("SELECT rebuttal_text, raw_evaluation, argument_score FROM debate_turns WHERE id='da24b6b12fa94a44ac548acc6f0c8672'").fetchone()
print("REBUTTAL:\n", row[0])
print("ARG_SCORE:\n", row[2])
print("RAW_EVAL:\n", row[1][:300] if row[1] else None)
