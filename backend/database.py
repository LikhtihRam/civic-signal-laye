"""Database connection and schema management for CivicSentinel."""
import sqlite3
import json
from pathlib import Path
from contextlib import contextmanager
from config import DB_PATH


def get_db_path() -> str:
    return str(DB_PATH)


@contextmanager
def get_db():
    """Context manager for SQLite database connections."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables for the CivicSentinel schema."""
    with get_db() as conn:
        conn.executescript("""
            -- Raw complaint ingestion
            CREATE TABLE IF NOT EXISTS complaints (
                id TEXT PRIMARY KEY,
                raw_text TEXT NOT NULL,
                source_platform TEXT DEFAULT 'synthetic',
                timestamp TEXT NOT NULL,
                lat REAL,
                long REAL,
                ward TEXT,
                category_raw TEXT,
                image_url TEXT,
                citizen_id_masked TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- AI-structured complaint output
            CREATE TABLE IF NOT EXISTS structured_complaints (
                complaint_id TEXT PRIMARY KEY,
                extracted_location TEXT,
                category TEXT,
                severity TEXT CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')),
                urgency_flag INTEGER DEFAULT 0,
                affected_population_estimate INTEGER DEFAULT 0,
                sentiment TEXT,
                embedding_vector TEXT,
                FOREIGN KEY (complaint_id) REFERENCES complaints(id)
            );

            -- Cluster of related complaints
            CREATE TABLE IF NOT EXISTS clusters (
                id TEXT PRIMARY KEY,
                member_complaint_ids TEXT NOT NULL,
                centroid_lat REAL,
                centroid_long REAL,
                ward TEXT,
                category_family TEXT,
                time_window_start TEXT,
                time_window_end TEXT,
                status TEXT DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'false_positive', 'verified')),
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Root cause hypotheses per cluster
            CREATE TABLE IF NOT EXISTS root_cause_hypotheses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cluster_id TEXT NOT NULL,
                hypothesis_text TEXT NOT NULL,
                confidence_level REAL,
                supporting_evidence TEXT,
                rank INTEGER DEFAULT 1,
                FOREIGN KEY (cluster_id) REFERENCES clusters(id)
            );

            -- Risk scores per cluster
            CREATE TABLE IF NOT EXISTS risk_scores (
                cluster_id TEXT PRIMARY KEY,
                frequency_score REAL DEFAULT 0,
                severity_score REAL DEFAULT 0,
                recurrence_score REAL DEFAULT 0,
                geo_concentration_score REAL DEFAULT 0,
                safety_score REAL DEFAULT 0,
                total_score REAL DEFAULT 0,
                risk_bucket TEXT,
                FOREIGN KEY (cluster_id) REFERENCES clusters(id)
            );

            -- Recommendations per cluster
            CREATE TABLE IF NOT EXISTS recommendations (
                cluster_id TEXT PRIMARY KEY,
                suggested_action TEXT,
                department TEXT,
                priority TEXT,
                response_window TEXT,
                draft_advisory_text TEXT,
                FOREIGN KEY (cluster_id) REFERENCES clusters(id)
            );

            -- Authority feedback / action log
            CREATE TABLE IF NOT EXISTS action_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cluster_id TEXT NOT NULL,
                authority_id TEXT DEFAULT 'demo_officer',
                action_taken TEXT,
                actual_root_cause TEXT,
                status_update TEXT CHECK(status_update IN ('verified', 'false_positive', 'resolved')),
                resolved_date TEXT,
                outcome_notes TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (cluster_id) REFERENCES clusters(id)
            );

            -- Pipeline run tracking
            CREATE TABLE IF NOT EXISTS pipeline_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT DEFAULT (datetime('now')),
                completed_at TEXT,
                status TEXT DEFAULT 'running',
                complaints_processed INTEGER DEFAULT 0,
                clusters_created INTEGER DEFAULT 0,
                notes TEXT
            );
        """)
    print("Database initialized successfully.")


def row_to_dict(row):
    """Convert a sqlite3.Row to a dict."""
    if row is None:
        return None
    return dict(row)


def rows_to_dicts(rows):
    """Convert a list of sqlite3.Row to list of dicts."""
    return [dict(r) for r in rows]


def parse_json_field(value):
    """Parse a JSON string field, returning None on failure."""
    if value is None:
        return None
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value
