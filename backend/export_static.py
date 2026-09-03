"""Export database data as static JSON files for the frontend."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from database import get_db, parse_json_field

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"


def export_stats():
    with get_db() as conn:
        total_complaints = conn.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]
        total_clusters = conn.execute("SELECT COUNT(*) FROM clusters").fetchone()[0]
        urgent = conn.execute("SELECT COUNT(*) FROM structured_complaints WHERE urgency_flag = 1").fetchone()[0]
        critical = conn.execute("SELECT COUNT(*) FROM structured_complaints WHERE severity = 'Critical'").fetchone()[0]

        risk_dist = conn.execute("SELECT risk_bucket, COUNT(*) as cnt FROM risk_scores GROUP BY risk_bucket").fetchall()
        ward_dist = conn.execute("SELECT ward, COUNT(*) as cnt FROM complaints GROUP BY ward ORDER BY cnt DESC").fetchall()
        cat_dist = conn.execute("SELECT sc.category, COUNT(*) as cnt FROM structured_complaints sc GROUP BY sc.category ORDER BY cnt DESC").fetchall()

        return {
            "total_complaints": total_complaints,
            "total_clusters": total_clusters,
            "urgent_complaints": urgent,
            "critical_complaints": critical,
            "risk_distribution": {r["risk_bucket"]: r["cnt"] for r in risk_dist},
            "ward_distribution": {r["ward"]: r["cnt"] for r in ward_dist},
            "category_distribution": {r["category"]: r["cnt"] for r in cat_dist},
        }


def export_clusters_list():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT c.*, rs.total_score, rs.risk_bucket, rs.frequency_score, rs.severity_score, rs.safety_score
            FROM clusters c LEFT JOIN risk_scores rs ON c.id = rs.cluster_id
            ORDER BY rs.total_score DESC NULLS LAST
        """).fetchall()
        clusters = []
        for row in rows:
            c = dict(row)
            c["member_complaint_ids"] = parse_json_field(c.get("member_complaint_ids"))
            c["member_count"] = len(c["member_complaint_ids"]) if c["member_complaint_ids"] else 0
            clusters.append(c)
        return {"clusters": clusters, "total": len(clusters)}


def export_map_data():
    with get_db() as conn:
        clusters = conn.execute("""
            SELECT c.id, c.centroid_lat, c.centroid_long, c.ward, c.category_family,
                   c.member_complaint_ids, rs.total_score, rs.risk_bucket
            FROM clusters c LEFT JOIN risk_scores rs ON c.id = rs.cluster_id
            WHERE c.centroid_lat IS NOT NULL
        """).fetchall()

        result = []
        for cl in clusters:
            member_ids = parse_json_field(cl["member_complaint_ids"])
            member_count = len(member_ids) if member_ids else 0
            complaint_locations = []
            if member_ids:
                placeholders = ",".join("?" * len(member_ids))
                loc_rows = conn.execute(f"""
                    SELECT lat, long, ward FROM complaints WHERE id IN ({placeholders})
                """, member_ids).fetchall()
                complaint_locations = [{"lat": r["lat"], "long": r["long"], "ward": r["ward"]} for r in loc_rows]
            result.append({
                "cluster_id": cl["id"],
                "centroid_lat": cl["centroid_lat"],
                "centroid_long": cl["centroid_long"],
                "ward": cl["ward"],
                "category_family": cl["category_family"],
                "member_count": member_count,
                "risk_score": cl["total_score"],
                "risk_bucket": cl["risk_bucket"],
                "complaint_locations": complaint_locations,
            })
        return {"clusters": result}


def export_cluster_detail(cluster_id):
    with get_db() as conn:
        cluster = conn.execute("SELECT * FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
        if not cluster:
            return None
        cluster = dict(cluster)
        member_ids = parse_json_field(cluster["member_complaint_ids"])

        complaints = []
        if member_ids:
            placeholders = ",".join("?" * len(member_ids))
            complaint_rows = conn.execute(f"""
                SELECT c.*, sc.category, sc.severity, sc.urgency_flag,
                       sc.affected_population_estimate, sc.sentiment
                FROM complaints c JOIN structured_complaints sc ON c.id = sc.complaint_id
                WHERE c.id IN ({placeholders}) ORDER BY c.timestamp
            """, member_ids).fetchall()
            complaints = [dict(r) for r in complaint_rows]

        risk = conn.execute("SELECT * FROM risk_scores WHERE cluster_id = ?", (cluster_id,)).fetchone()
        risk_data = dict(risk) if risk else None

        hypotheses = conn.execute(
            "SELECT * FROM root_cause_hypotheses WHERE cluster_id = ? ORDER BY rank", (cluster_id,)
        ).fetchall()
        root_causes = []
        for h in hypotheses:
            h_dict = dict(h)
            h_dict["supporting_evidence"] = parse_json_field(h_dict.get("supporting_evidence"))
            root_causes.append(h_dict)

        rec = conn.execute("SELECT * FROM recommendations WHERE cluster_id = ?", (cluster_id,)).fetchone()
        rec_data = dict(rec) if rec else None

        actions = conn.execute("SELECT * FROM action_log WHERE cluster_id = ? ORDER BY created_at DESC", (cluster_id,)).fetchall()
        action_log = [dict(a) for a in actions]

        cluster["member_complaints"] = complaints
        cluster["risk_score"] = risk_data
        cluster["root_causes"] = root_causes
        cluster["recommendation"] = rec_data
        cluster["action_log"] = action_log
        return cluster


def export_wards():
    with get_db() as conn:
        rows = conn.execute("SELECT ward, COUNT(*) as complaint_count FROM complaints GROUP BY ward ORDER BY complaint_count DESC").fetchall()
        return {"wards": [dict(r) for r in rows]}


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Exporting to {OUTPUT_DIR}/")

    # Stats
    with open(OUTPUT_DIR / "stats.json", "w") as f:
        json.dump(export_stats(), f)
    print("  stats.json")

    # Clusters list
    clusters_data = export_clusters_list()
    with open(OUTPUT_DIR / "clusters.json", "w") as f:
        json.dump(clusters_data, f)
    print("  clusters.json")

    # Map data
    with open(OUTPUT_DIR / "map-data.json", "w") as f:
        json.dump(export_map_data(), f)
    print("  map-data.json")

    # Wards
    with open(OUTPUT_DIR / "wards.json", "w") as f:
        json.dump(export_wards(), f)
    print("  wards.json")

    # Clean stale cluster files
    current_ids = {c["id"] for c in clusters_data["clusters"]}
    for old_file in OUTPUT_DIR.glob("cluster-*.json"):
        cid = old_file.stem.replace("cluster-", "")
        if cid not in current_ids:
            old_file.unlink()
            print(f"  cleaned stale: {old_file.name}")

    # Individual cluster details
    for cluster in clusters_data["clusters"]:
        detail = export_cluster_detail(cluster["id"])
        if detail:
            n = len(detail.get("member_complaints", []))
            with open(OUTPUT_DIR / f"cluster-{cluster['id']}.json", "w") as f:
                json.dump(detail, f)
            print(f"  cluster-{cluster['id']}.json ({n} complaints)")

    print(f"\nExported {len(clusters_data['clusters'])} clusters + shared data")


if __name__ == "__main__":
    main()
