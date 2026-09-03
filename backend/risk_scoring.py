"""Explainable Risk Scoring Engine.

risk_score = w1*frequency + w2*severity + w3*recurrence + w4*geo_concentration + w5*safety_risk

Each component is normalized to 0-100 and multiplied by its weight.
The final score is the weighted sum, bucketed into Watch/Elevated/High-Risk/Critical.
"""
import json
from typing import List, Dict
from datetime import datetime, timedelta
from database import get_db, parse_json_field
from config import RISK_WEIGHTS, RISK_BUCKETS, GEO_CLUSTER_RADIUS_M
from clustering import haversine_distance


def compute_frequency_score(member_count: int) -> float:
    """Normalize complaint count to 0-100 scale.
    1 complaint = ~5, 30+ complaints = 100.
    """
    return min(100, (member_count / 30) * 100)


def compute_severity_score(complaints: List[dict]) -> float:
    """Weighted average of severity across complaints."""
    severity_map = {"Low": 15, "Medium": 40, "High": 70, "Critical": 95}
    if not complaints:
        return 0
    total = sum(severity_map.get(c.get("severity", "Low"), 15) for c in complaints)
    return min(100, total / len(complaints))


def compute_recurrence_score(complaints: List[dict]) -> float:
    """Score based on how spread out complaints are over time (recurrence = sustained problem)."""
    if len(complaints) < 2:
        return 20  # Minimum baseline
    
    timestamps = sorted([datetime.fromisoformat(c["timestamp"]) for c in complaints])
    timespan_days = (timestamps[-1] - timestamps[0]).days + 1
    
    # More days spanned = more recurring
    # 1 day = 10, 30 days = 100
    return min(100, (timespan_days / 30) * 100)


def compute_geo_concentration_score(complaints: List[dict]) -> float:
    """Score based on how tightly concentrated complaints are geographically."""
    if len(complaints) < 2:
        return 20
    
    lats = [c["lat"] for c in complaints if c.get("lat")]
    longs = [c["long"] for c in complaints if c.get("long")]
    
    if not lats or not longs:
        return 20
    
    # Calculate average distance from centroid
    center_lat = sum(lats) / len(lats)
    center_long = sum(longs) / len(longs)
    
    distances = [
        haversine_distance(center_lat, center_long, lat, lng)
        for lat, lng in zip(lats, longs)
    ]
    avg_distance = sum(distances) / len(distances)
    
    # Closer = higher score
    # 0m = 100, 500m = 50, 1000m+ = low
    return max(0, min(100, 100 - (avg_distance / 10)))


def compute_safety_risk_score(complaints: List[dict]) -> float:
    """Score based on urgency flags and severity distribution toward safety-critical issues."""
    if not complaints:
        return 0
    
    urgent_count = sum(1 for c in complaints if c.get("urgency_flag"))
    critical_count = sum(1 for c in complaints if c.get("severity") == "Critical")
    high_count = sum(1 for c in complaints if c.get("severity") == "High")
    
    n = len(complaints)
    urgency_ratio = urgent_count / n
    danger_ratio = (critical_count + high_count * 0.5) / n
    
    return min(100, (urgency_ratio * 60 + danger_ratio * 40) * 100)


def compute_risk_score(cluster_id: str) -> dict:
    """Compute explainable risk score for a cluster.
    
    Returns a breakdown dict with each component and the total.
    """
    with get_db() as conn:
        cluster = conn.execute("SELECT * FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
        if not cluster:
            return {"error": "Cluster not found"}
        
        cluster = dict(cluster)
        member_ids = json.loads(cluster["member_complaint_ids"])
        
        if not member_ids:
            return {"error": "No members in cluster"}
        
        # Fetch all member complaints
        placeholders = ",".join("?" * len(member_ids))
        complaints = conn.execute(f"""
            SELECT c.*, sc.category, sc.severity, sc.urgency_flag, 
                   sc.affected_population_estimate, sc.sentiment
            FROM complaints c
            JOIN structured_complaints sc ON c.id = sc.complaint_id
            WHERE c.id IN ({placeholders})
        """, member_ids).fetchall()
        
        complaints = [dict(c) for c in complaints]
        
        if not complaints:
            return {"error": "No structured complaints found for cluster"}
        
        # Compute each component
        freq = compute_frequency_score(len(complaints))
        sev = compute_severity_score(complaints)
        rec = compute_recurrence_score(complaints)
        geo = compute_geo_concentration_score(complaints)
        safety = compute_safety_risk_score(complaints)
        
        # Weighted total
        total = (
            RISK_WEIGHTS["frequency"] * freq +
            RISK_WEIGHTS["severity"] * sev +
            RISK_WEIGHTS["recurrence"] * rec +
            RISK_WEIGHTS["geo_concentration"] * geo +
            RISK_WEIGHTS["safety_risk"] * safety
        )
        
        total = round(min(100, max(0, total)), 1)
        
        # Determine bucket
        bucket = "Watch"
        for name, (low, high) in RISK_BUCKETS.items():
            if low <= total < high:
                bucket = name
                break
        if total >= 80:
            bucket = "Critical"
        
        breakdown = {
            "frequency": {
                "score": round(freq, 1),
                "weight": RISK_WEIGHTS["frequency"],
                "contribution": round(RISK_WEIGHTS["frequency"] * freq, 1),
                "detail": f"{len(complaints)} complaints in cluster",
            },
            "severity": {
                "score": round(sev, 1),
                "weight": RISK_WEIGHTS["severity"],
                "contribution": round(RISK_WEIGHTS["severity"] * sev, 1),
                "detail": f"Average severity weighted across {len(complaints)} complaints",
            },
            "recurrence": {
                "score": round(rec, 1),
                "weight": RISK_WEIGHTS["recurrence"],
                "contribution": round(RISK_WEIGHTS["recurrence"] * rec, 1),
                "detail": f"Issue reported over {rec:.0f}% of the 30-day window",
            },
            "geo_concentration": {
                "score": round(geo, 1),
                "weight": RISK_WEIGHTS["geo_concentration"],
                "contribution": round(RISK_WEIGHTS["geo_concentration"] * geo, 1),
                "detail": "Complaints concentrated in a small geographic area",
            },
            "safety_risk": {
                "score": round(safety, 1),
                "weight": RISK_WEIGHTS["safety_risk"],
                "contribution": round(RISK_WEIGHTS["safety_risk"] * safety, 1),
                "detail": f"{sum(1 for c in complaints if c.get('urgency_flag'))} urgent flags, {sum(1 for c in complaints if c.get('severity') == 'Critical')} critical",
            },
        }
        
        result = {
            "cluster_id": cluster_id,
            "total_score": total,
            "risk_bucket": bucket,
            "breakdown": breakdown,
            "complaint_count": len(complaints),
        }
        
        # Persist to DB
        conn.execute("""
            INSERT OR REPLACE INTO risk_scores
            (cluster_id, frequency_score, severity_score, recurrence_score, 
             geo_concentration_score, safety_score, total_score, risk_bucket)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            cluster_id,
            round(freq, 1), round(sev, 1), round(rec, 1),
            round(geo, 1), round(safety, 1),
            total, bucket,
        ))
        
        return result


def score_all_clusters() -> List[dict]:
    """Score all clusters in the database."""
    with get_db() as conn:
        clusters = conn.execute("SELECT id FROM clusters").fetchall()
    
    results = []
    for c in clusters:
        result = compute_risk_score(c["id"])
        results.append(result)
        if "error" not in result:
            print(f"  {c['id']}: {result['total_score']:.1f} ({result['risk_bucket']})")
    
    return results


if __name__ == "__main__":
    results = score_all_clusters()
    print(f"\nScored {len(results)} clusters")
    for r in results:
        if "error" not in r:
            print(f"  {r['cluster_id']}: {r['total_score']} — {r['risk_bucket']}")
