import sqlite3

def fix_table():
    conn = sqlite3.connect("debatelab.db")
    cur = conn.cursor()

    cur.execute("PRAGMA foreign_keys=OFF;")
    conn.commit()

    # Create new debate_turns table with proper unique constraint including attempt_number
    cur.execute("""
    CREATE TABLE debate_turns_new (
        id CHAR(32) NOT NULL PRIMARY KEY,
        session_id CHAR(32) NOT NULL,
        turn_number INTEGER NOT NULL,
        attempt_number SMALLINT NOT NULL DEFAULT 1,
        parent_turn_id CHAR(32),
        speaker VARCHAR(10) NOT NULL,
        user_transcript TEXT,
        rebuttal_text TEXT,
        filler_words_detected JSON NOT NULL DEFAULT '[]',
        fallacies_flagged JSON NOT NULL DEFAULT '[]',
        pauses_detected JSON NOT NULL DEFAULT '[]',
        verified_fallacy_count SMALLINT DEFAULT 0,
        total_fallacy_count SMALLINT DEFAULT 0,
        confidence_score SMALLINT,
        argument_score SMALLINT,
        hesitation_index SMALLINT,
        words_per_minute NUMERIC(6, 1),
        duration_ms INTEGER,
        raw_evaluation JSON DEFAULT '{}',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_session_turn_speaker_attempt UNIQUE (session_id, turn_number, speaker, attempt_number),
        CONSTRAINT fk_turn_parent FOREIGN KEY (parent_turn_id) REFERENCES debate_turns (id) ON DELETE SET NULL,
        FOREIGN KEY (session_id) REFERENCES debate_sessions (id) ON DELETE CASCADE
    );
    """)
    conn.commit()

    # Copy data over
    cur.execute("""
    INSERT INTO debate_turns_new (
        id, session_id, turn_number, attempt_number, parent_turn_id, speaker,
        user_transcript, rebuttal_text, filler_words_detected, fallacies_flagged,
        pauses_detected, verified_fallacy_count, total_fallacy_count,
        confidence_score, argument_score, hesitation_index, words_per_minute,
        duration_ms, raw_evaluation, created_at
    )
    SELECT
        id, session_id, turn_number, attempt_number, parent_turn_id, speaker,
        user_transcript, rebuttal_text, filler_words_detected, fallacies_flagged,
        pauses_detected, verified_fallacy_count, total_fallacy_count,
        confidence_score, argument_score, hesitation_index, words_per_minute,
        duration_ms, raw_evaluation, created_at
    FROM debate_turns;
    """)
    conn.commit()

    cur.execute("DROP TABLE debate_turns;")
    cur.execute("ALTER TABLE debate_turns_new RENAME TO debate_turns;")
    conn.commit()

    cur.execute("PRAGMA foreign_keys=ON;")
    conn.commit()

    print("Successfully updated debate_turns table constraint.")

if __name__ == "__main__":
    fix_table()
