"""Ingest CSV seed data into the SQLite database."""
import csv
import sys
from pathlib import Path
from database import get_db, init_db

SEED_CSV = Path(__file__).parent / "seed_data.csv"


def ingest_csv(csv_path: str = None, clear_existing: bool = True):
    """Load complaints from CSV into the database."""
    path = Path(csv_path) if csv_path else SEED_CSV
    if not path.exists():
        print(f"Error: CSV not found at {path}")
        print("Run 'python3 seed.py' first to generate the seed data.")
        sys.exit(1)
    
    # Initialize DB schema
    init_db()
    
    with get_db() as conn:
        if clear_existing:
            conn.execute("DELETE FROM action_log")
            conn.execute("DELETE FROM recommendations")
            conn.execute("DELETE FROM risk_scores")
            conn.execute("DELETE FROM root_cause_hypotheses")
            conn.execute("DELETE FROM clusters")
            conn.execute("DELETE FROM structured_complaints")
            conn.execute("DELETE FROM complaints")
            print("Cleared existing data.")
        
        count = 0
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                conn.execute("""
                    INSERT OR REPLACE INTO complaints 
                    (id, raw_text, source_platform, timestamp, lat, long, ward, category_raw, image_url, citizen_id_masked)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    row["id"],
                    row["raw_text"],
                    row["source_platform"],
                    row["timestamp"],
                    float(row["lat"]) if row.get("lat") else None,
                    float(row["long"]) if row.get("long") else None,
                    row["ward"],
                    row["category_raw"],
                    row.get("image_url") or None,
                    row.get("citizen_id_masked") or None,
                ))
                count += 1
        
        # Verify
        total = conn.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]
        ward_counts = conn.execute(
            "SELECT ward, COUNT(*) as cnt FROM complaints GROUP BY ward ORDER BY cnt DESC"
        ).fetchall()
        
        print(f"\nIngested {count} complaints (total in DB: {total})")
        print("\nBy ward:")
        for row in ward_counts:
            print(f"  {row[0]}: {row[1]} complaints")
    
    return count


if __name__ == "__main__":
    ingest_csv()
