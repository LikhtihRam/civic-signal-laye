"""Full CivicSentinel Pipeline — runs the complete analysis flow."""
import sys
import time
from datetime import datetime
from database import get_db, init_db
from seed import generate_seed_data
from ingest import ingest_csv
from extraction import process_all_complaints
from clustering import cluster_complaints
from root_cause import generate_root_cause, generate_all_root_causes
from risk_scoring import compute_risk_score, score_all_clusters
from recommendation import generate_recommendation, generate_all_recommendations


def run_full_pipeline(seed: bool = True) -> dict:
    """Run the complete pipeline and return summary."""
    start = time.time()
    print("=" * 60)
    print("  CivicSentinel Pipeline — Full Run")
    print("=" * 60)
    
    results = {
        "started_at": datetime.now().isoformat(),
        "steps": [],
    }
    
    # Step 1: Seed data
    if seed:
        print("\n[Step 1] Generating seed data...")
        csv_path = generate_seed_data()
        results["steps"].append({"step": "seed", "status": "ok", "file": str(csv_path)})
    else:
        print("\n[Step 1] Skipping seed generation (using existing data)")
        results["steps"].append({"step": "seed", "status": "skipped"})
    
    # Step 2: Ingest
    print("\n[Step 2] Ingesting into database...")
    init_db()
    count = ingest_csv()
    results["steps"].append({"step": "ingest", "status": "ok", "complaints": count})
    
    # Step 3: AI Extraction
    print("\n[Step 3] Running AI extraction...")
    extracted = process_all_complaints()
    results["steps"].append({"step": "extraction", "status": "ok", "processed": extracted})
    
    # Step 4: Clustering
    print("\n[Step 4] Running DBSCAN clustering...")
    clusters = cluster_complaints()
    results["steps"].append({"step": "clustering", "status": "ok", "clusters": len(clusters)})
    
    # Step 5: Root Cause Generation
    print("\n[Step 5] Generating root cause hypotheses...")
    generate_all_root_causes()
    results["steps"].append({"step": "root_cause", "status": "ok"})
    
    # Step 6: Risk Scoring
    print("\n[Step 6] Computing risk scores...")
    scored = score_all_clusters()
    results["steps"].append({"step": "risk_scoring", "status": "ok", "scored": len(scored)})
    
    # Step 7: Recommendations
    print("\n[Step 7] Generating recommendations...")
    generate_all_recommendations()
    results["steps"].append({"step": "recommendations", "status": "ok"})
    
    elapsed = time.time() - start
    results["completed_at"] = datetime.now().isoformat()
    results["elapsed_seconds"] = round(elapsed, 1)
    
    # Summary
    print("\n" + "=" * 60)
    print("  Pipeline Complete!")
    print("=" * 60)
    print(f"  Complaints ingested: {count}")
    print(f"  Complaints extracted: {extracted}")
    print(f"  Clusters formed: {len(clusters)}")
    print(f"  Risk scores computed: {len(scored)}")
    print(f"  Time elapsed: {elapsed:.1f}s")
    
    # Show top clusters
    with get_db() as conn:
        top_clusters = conn.execute("""
            SELECT c.id, c.ward, c.category_family, c.member_complaint_ids,
                   rs.total_score, rs.risk_bucket
            FROM clusters c
            LEFT JOIN risk_scores rs ON c.id = rs.cluster_id
            ORDER BY rs.total_score DESC NULLS LAST
        """).fetchall()
        
        print(f"\n  Top clusters by risk:")
        for tc in top_clusters:
            import json
            member_count = len(json.loads(tc["member_complaint_ids"]))
            score = tc["total_score"] or "N/A"
            bucket = tc["risk_bucket"] or "N/A"
            print(f"    {tc['id']}: {member_count} complaints in {tc['ward']} / {tc['category_family']} → {score} ({bucket})")
    
    return results


if __name__ == "__main__":
    fresh = "--fresh" in sys.argv or "--seed" in sys.argv
    run_full_pipeline(seed=fresh or True)
