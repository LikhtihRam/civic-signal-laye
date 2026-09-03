"""CivicSentinel — FastAPI REST API Server."""
import json
import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db, init_db, row_to_dict, rows_to_dicts, parse_json_field
from config import API_HOST, API_PORT, CORS_ORIGINS
from clustering import cluster_complaints
from risk_scoring import compute_risk_score
from root_cause import generate_root_cause
from recommendation import generate_recommendation
from extraction import extract_complaint_signals

app = FastAPI(
    title="CivicSentinel API",
    description="AI-Powered Civic Intelligence Layer — converting fragmented complaints into actionable signals",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Models ---

class ComplaintIngest(BaseModel):
    raw_text: str
    source_platform: str = "api"
    timestamp: Optional[str] = None
    lat: Optional[float] = None
    long: Optional[float] = None
    ward: Optional[str] = None
    category_raw: Optional[str] = None

class ComplaintBatch(BaseModel):
    complaints: List[ComplaintIngest]

class FeedbackIn(BaseModel):
    status: str  # verified, false_positive, resolved
    actual_root_cause: Optional[str] = None
    outcome_notes: Optional[str] = None
    authority_id: str = "demo_officer"


# --- Endpoints ---

@app.get("/")
def root():
    return {"message": "CivicSentinel API", "version": "1.0.0", "docs": "/docs"}


@app.get("/api/health")
def health():
    with get_db() as conn:
        complaints = conn.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]
        clusters = conn.execute("SELECT COUNT(*) FROM clusters").fetchone()[0]
    return {"status": "healthy", "complaints": complaints, "clusters": clusters}


@app.post("/api/ingest")
def ingest_complaints(batch: ComplaintBatch):
    """Accept new complaint(s) and store them."""
    created = []
    with get_db() as conn:
        for c in batch.complaints:
            cid = f"CMP-{str(uuid.uuid4())[:8].upper()}"
            timestamp = c.timestamp or datetime.now().isoformat()
            
            conn.execute("""
                INSERT INTO complaints 
                (id, raw_text, source_platform, timestamp, lat, long, ward, category_raw)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (cid, c.raw_text, c.source_platform, timestamp,
                  c.lat, c.long, c.ward, c.category_raw))
            created.append(cid)
    
    return {"status": "ok", "created": created, "count": len(created)}


@app.post("/api/process")
def run_processing_pipeline():
    """Run extraction + clustering + scoring pipeline (batch trigger for demo)."""
    results = {"extraction": 0, "clusters": 0, "risk_scores": 0}
    
    # Run extraction
    from extraction import process_all_complaints
    results["extraction"] = process_all_complaints()
    
    # Run clustering
    clusters = cluster_complaints()
    results["clusters"] = len(clusters)
    
    # Run risk scoring
    for cluster in clusters:
        compute_risk_score(cluster["id"])
    results["risk_scores"] = len(clusters)
    
    # Generate root causes
    for cluster in clusters:
        generate_root_cause(cluster["id"])
    
    # Generate recommendations
    for cluster in clusters:
        generate_recommendation(cluster["id"])
    
    return {"status": "ok", "results": results}


@app.get("/api/clusters")
def list_clusters(
    ward: Optional[str] = Query(None, description="Filter by ward"),
    category: Optional[str] = Query(None, description="Filter by category family"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (Watch/Elevated/High-Risk/Critical)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List clusters with risk scores, filterable by ward/category/risk level."""
    with get_db() as conn:
        query = """
            SELECT c.*, rs.total_score, rs.risk_bucket, rs.frequency_score, 
                   rs.severity_score, rs.safety_score
            FROM clusters c
            LEFT JOIN risk_scores rs ON c.id = rs.cluster_id
            WHERE 1=1
        """
        params = []
        
        if ward:
            query += " AND c.ward = ?"
            params.append(ward)
        if category:
            query += " AND c.category_family = ?"
            params.append(category)
        if risk_level:
            query += " AND rs.risk_bucket = ?"
            params.append(risk_level)
        
        # Count total
        count_query = query.replace(
            "SELECT c.*, rs.total_score, rs.risk_bucket, rs.frequency_score, \n                   rs.severity_score, rs.safety_score",
            "SELECT COUNT(*)"
        )
        total = conn.execute(count_query, params).fetchone()[0]
        
        query += " ORDER BY rs.total_score DESC NULLS LAST"
        query += " LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        rows = conn.execute(query, params).fetchall()
        clusters = []
        for row in rows:
            c = dict(row)
            c["member_complaint_ids"] = parse_json_field(c.get("member_complaint_ids"))
            c["member_count"] = len(c["member_complaint_ids"]) if c["member_complaint_ids"] else 0
            clusters.append(c)
        
        return {"clusters": clusters, "total": total, "limit": limit, "offset": offset}


@app.get("/api/clusters/{cluster_id}")
def get_cluster_detail(cluster_id: str):
    """Get full cluster detail: member complaints, root cause, risk breakdown, recommendation."""
    with get_db() as conn:
        cluster = conn.execute("SELECT * FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
        if not cluster:
            raise HTTPException(status_code=404, detail="Cluster not found")
        
        cluster = dict(cluster)
        member_ids = parse_json_field(cluster["member_complaint_ids"])
        
        # Fetch member complaints with structured data
        complaints = []
        if member_ids:
            placeholders = ",".join("?" * len(member_ids))
            complaint_rows = conn.execute(f"""
                SELECT c.*, sc.category, sc.severity, sc.urgency_flag, 
                       sc.affected_population_estimate, sc.sentiment
                FROM complaints c
                JOIN structured_complaints sc ON c.id = sc.complaint_id
                WHERE c.id IN ({placeholders})
                ORDER BY c.timestamp
            """, member_ids).fetchall()
            complaints = [dict(r) for r in complaint_rows]
        
        # Risk score
        risk = conn.execute("SELECT * FROM risk_scores WHERE cluster_id = ?", (cluster_id,)).fetchone()
        risk_data = dict(risk) if risk else None
        
        # Root causes
        hypotheses = conn.execute(
            "SELECT * FROM root_cause_hypotheses WHERE cluster_id = ? ORDER BY rank",
            (cluster_id,)
        ).fetchall()
        root_causes = []
        for h in hypotheses:
            h_dict = dict(h)
            h_dict["supporting_evidence"] = parse_json_field(h_dict.get("supporting_evidence"))
            root_causes.append(h_dict)
        
        # Recommendation
        rec = conn.execute("SELECT * FROM recommendations WHERE cluster_id = ?", (cluster_id,)).fetchone()
        rec_data = dict(rec) if rec else None
        
        # Action log
        actions = conn.execute(
            "SELECT * FROM action_log WHERE cluster_id = ? ORDER BY created_at DESC",
            (cluster_id,)
        ).fetchall()
        action_log = [dict(a) for a in actions]
        
        cluster["member_complaints"] = complaints
        cluster["risk_score"] = risk_data
        cluster["root_causes"] = root_causes
        cluster["recommendation"] = rec_data
        cluster["action_log"] = action_log
        
        return cluster


@app.post("/api/clusters/{cluster_id}/feedback")
def submit_feedback(cluster_id: str, feedback: FeedbackIn):
    """Authority marks cluster status and logs actual root cause."""
    if feedback.status not in ("verified", "false_positive", "resolved"):
        raise HTTPException(status_code=400, detail="Status must be: verified, false_positive, or resolved")
    
    with get_db() as conn:
        cluster = conn.execute("SELECT id FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
        if not cluster:
            raise HTTPException(status_code=404, detail="Cluster not found")
        
        # Update cluster status
        new_status = "resolved" if feedback.status == "resolved" else feedback.status
        conn.execute("UPDATE clusters SET status = ? WHERE id = ?", (new_status, cluster_id))
        
        # Log action
        conn.execute("""
            INSERT INTO action_log
            (cluster_id, authority_id, action_taken, actual_root_cause, 
             status_update, outcome_notes)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            cluster_id,
            feedback.authority_id,
            feedback.status,
            feedback.actual_root_cause,
            feedback.status,
            feedback.outcome_notes,
        ))
    
    return {"status": "ok", "cluster_id": cluster_id, "updated_status": new_status}


@app.get("/api/stats")
def get_stats():
    """Dashboard summary statistics."""
    with get_db() as conn:
        total_complaints = conn.execute("SELECT COUNT(*) FROM complaints").fetchone()[0]
        total_clusters = conn.execute("SELECT COUNT(*) FROM clusters").fetchone()[0]
        
        # Risk distribution
        risk_dist = conn.execute("""
            SELECT risk_bucket, COUNT(*) as cnt FROM risk_scores GROUP BY risk_bucket
        """).fetchall()
        
        # Ward distribution
        ward_dist = conn.execute("""
            SELECT ward, COUNT(*) as cnt FROM complaints GROUP BY ward ORDER BY cnt DESC
        """).fetchall()
        
        # Category distribution
        cat_dist = conn.execute("""
            SELECT sc.category, COUNT(*) as cnt 
            FROM structured_complaints sc 
            GROUP BY sc.category ORDER BY cnt DESC
        """).fetchall()
        
        # Urgency stats
        urgent = conn.execute(
            "SELECT COUNT(*) FROM structured_complaints WHERE urgency_flag = 1"
        ).fetchone()[0]
        
        critical = conn.execute(
            "SELECT COUNT(*) FROM structured_complaints WHERE severity = 'Critical'"
        ).fetchone()[0]
        
        return {
            "total_complaints": total_complaints,
            "total_clusters": total_clusters,
            "urgent_complaints": urgent,
            "critical_complaints": critical,
            "risk_distribution": {r["risk_bucket"]: r["cnt"] for r in risk_dist},
            "ward_distribution": {r["ward"]: r["cnt"] for r in ward_dist},
            "category_distribution": {r["category"]: r["cnt"] for r in cat_dist},
        }


@app.get("/api/wards")
def list_wards():
    """List all wards with complaint counts."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT ward, COUNT(*) as complaint_count 
            FROM complaints GROUP BY ward ORDER BY complaint_count DESC
        """).fetchall()
        return {"wards": [dict(r) for r in rows]}


@app.get("/api/map-data")
def get_map_data():
    """Get all cluster centroids and member locations for the map."""
    with get_db() as conn:
        clusters = conn.execute("""
            SELECT c.id, c.centroid_lat, c.centroid_long, c.ward, c.category_family,
                   c.member_complaint_ids, rs.total_score, rs.risk_bucket
            FROM clusters c
            LEFT JOIN risk_scores rs ON c.id = rs.cluster_id
            WHERE c.centroid_lat IS NOT NULL
        """).fetchall()
        
        result = []
        for cl in clusters:
            member_ids = parse_json_field(cl["member_complaint_ids"])
            member_count = len(member_ids) if member_ids else 0
            
            # Get individual complaint locations
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


if __name__ == "__main__":
    import uvicorn
    init_db()
    print(f"Starting CivicSentinel API on {API_HOST}:{API_PORT}")
    uvicorn.run(app, host=API_HOST, port=API_PORT, reload=False)
