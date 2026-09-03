"""Root Cause Hypothesis Generator — uses Gemini to hypothesize underlying causes."""
import json
from typing import List, Dict
from database import get_db, parse_json_field
from llm_client import call_llm, parse_json_response, offline_extract, _strip_pii
from config import GEMINI_API_KEY

ROOT_CAUSE_SYSTEM_PROMPT = """You are a municipal infrastructure analyst AI. Given a cluster of related citizen complaints, generate 2-3 ranked hypotheses about the root cause.

You MUST respond with ONLY valid JSON — no markdown, no preamble.

Return exactly this structure:
{
  "hypotheses": [
    {
      "hypothesis_text": "Clear description of the probable root cause",
      "confidence_level": 0.85,
      "supporting_evidence": [
        "Exact phrase or fact from the complaints that supports this hypothesis",
        "Another supporting evidence phrase from the complaints"
      ]
    }
  ]
}

Rules:
- confidence_level is 0.0 to 1.0 (be realistic, not overconfident)
- supporting_evidence must be drawn from the actual complaint texts — never fabricate evidence
- Rank hypotheses by confidence (highest first)
- Be specific to municipal infrastructure, not generic
- Consider patterns across the complaints (frequency, location, timing, keywords)
- Each hypothesis should suggest a different potential root cause"""


def offline_root_cause(complaints: List[dict], cluster_info: dict) -> List[dict]:
    """Generate root cause hypotheses using keyword analysis when Gemini is unavailable."""
    category = cluster_info.get("category_family", "unknown")
    ward = cluster_info.get("ward", "unknown")
    
    # Analyze complaint texts
    texts = [c.get("raw_text", "") for c in complaints]
    all_text = " ".join(texts).lower()
    
    # Detect patterns
    has_burst = "burst" in all_text or "broke" in all_text
    has_leak = "leak" in all_text or "seepage" in all_text
    has_pressure = "pressure" in all_text or "trickle" in all_text
    has_aging = "old" in all_text or "corroded" in all_text or "rust" in all_text
    has_flooding = "flood" in all_text or "submerged" in all_text
    has_blocked = "blocked" in all_text or "clogged" in all_text
    has_pothole = "pothole" in all_text or "road damage" in all_text
    has_construction = "construction" in all_text
    
    evidence_pool = []
    for t in texts[:5]:
        clean = t[:120].strip()
        if clean:
            evidence_pool.append(clean)
    
    hypotheses = []
    
    if category == "water_infrastructure" or "water" in category:
        if has_burst or has_leak:
            hypotheses.append({
                "hypothesis_text": f"Aging or damaged water distribution pipeline in the {ward} area is causing multiple leak points, leading to road flooding, low pressure, and surface damage. The concentration of complaints suggests a main line failure rather than isolated incidents.",
                "confidence_level": 0.82 if has_burst else 0.70,
                "supporting_evidence": evidence_pool[:3],
            })
        if has_pressure:
            hypotheses.append({
                "hypothesis_text": f"The water supply infrastructure serving {ward} has insufficient pumping capacity or multiple underground leaks that are reducing pressure across the distribution network. This explains the simultaneous low-pressure and leakage complaints.",
                "confidence_level": 0.75,
                "supporting_evidence": [e for e in evidence_pool if "pressure" in e.lower() or "supply" in e.lower()][:3] or evidence_pool[:2],
            })
        if has_aging:
            hypotheses.append({
                "hypothesis_text": f"Decades-old cast iron water mains in {ward} have corroded beyond their service life, causing micro-leaks that collectively reduce system pressure and lead to visible surface water damage.",
                "confidence_level": 0.65,
                "supporting_evidence": evidence_pool[:2],
            })
    
    if category == "drainage" or "drain" in category:
        if has_blocked:
            hypotheses.append({
                "hypothesis_text": f"Storm drain infrastructure in {ward} is blocked by accumulated solid waste and construction debris, causing water to back up onto roads during rain. The systematic nature suggests inadequate maintenance schedule rather than isolated blockage.",
                "confidence_level": 0.80,
                "supporting_evidence": evidence_pool[:3],
            })
        hypotheses.append({
            "hypothesis_text": f"The drainage capacity of {ward} is insufficient for current population density. Rapid urbanization has outpaced drainage infrastructure upgrades, leading to chronic overflow.",
            "confidence_level": 0.68,
            "supporting_evidence": evidence_pool[:2],
        })
    
    if category == "roads" or "road" in category:
        if has_pothole:
            hypotheses.append({
                "hypothesis_text": f"Road surface degradation in {ward} caused by poor drainage (water ingress weakening the road base) combined with heavy vehicle traffic. The potholes are symptomatic of underlying drainage failure rather than just surface wear.",
                "confidence_level": 0.78,
                "supporting_evidence": evidence_pool[:3],
            })
        if has_construction:
            hypotheses.append({
                "hypothesis_text": f"Substandard road construction materials or techniques in recent maintenance work are causing premature road failure. Multiple complaints within a short period suggest systemic quality issues.",
                "confidence_level": 0.65,
                "supporting_evidence": evidence_pool[:2],
            })
    
    if not hypotheses:
        hypotheses.append({
            "hypothesis_text": f"Multiple infrastructure issues in {ward} suggest a pattern of deferred maintenance that requires a comprehensive survey of the area's civic infrastructure.",
            "confidence_level": 0.55,
            "supporting_evidence": evidence_pool[:2] or ["Multiple complaints received from the same area"],
        })
    
    # Ensure at least 2 hypotheses
    if len(hypotheses) < 2:
        hypotheses.append({
            "hypothesis_text": f"Insufficient maintenance resources allocated to {ward} may be causing a cascade of infrastructure failures across different systems.",
            "confidence_level": 0.50,
            "supporting_evidence": evidence_pool[:2] or ["Pattern of complaints across infrastructure types"],
        })
    
    return hypotheses[:3]


def generate_root_cause(cluster_id: str) -> List[dict]:
    """Generate root cause hypotheses for a cluster."""
    with get_db() as conn:
        cluster = conn.execute("SELECT * FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
        if not cluster:
            return []
        
        cluster = dict(cluster)
        member_ids = json.loads(cluster["member_complaint_ids"])
        
        if not member_ids:
            return []
        
        placeholders = ",".join("?" * len(member_ids))
        complaints = conn.execute(f"""
            SELECT c.id, c.raw_text, c.ward, c.timestamp, 
                   sc.category, sc.severity, sc.urgency_flag
            FROM complaints c
            JOIN structured_complaints sc ON c.id = sc.complaint_id
            WHERE c.id IN ({placeholders})
        """, member_ids).fetchall()
        
        complaints = [dict(c) for c in complaints]
        
        if not complaints:
            return []
        
        cluster_info = {
            "category_family": cluster.get("category_family", "unknown"),
            "ward": cluster.get("ward", "unknown"),
            "time_span_days": (
                datetime.fromisoformat(cluster["time_window_end"]) - 
                datetime.fromisoformat(cluster["time_window_start"])
            ).days if cluster.get("time_window_start") and cluster.get("time_window_end") else 0,
        }
        
        # Try Gemini first
        if GEMINI_API_KEY:
            try:
                # Build summary for LLM
                summary_lines = []
                for c in complaints[:20]:  # Limit to 20 for token efficiency
                    clean = _strip_pii(c["raw_text"][:200])
                    summary_lines.append(f"- [{c['severity']}] ({c['category']}) {clean}")
                
                user_prompt = f"""Cluster Summary:
- Ward: {cluster_info['ward']}
- Category family: {cluster_info['category_family']}
- Number of complaints: {len(complaints)}
- Time span: {cluster_info['time_span_days']} days

Complaint samples:
{chr(10).join(summary_lines)}

Generate 2-3 ranked root cause hypotheses with confidence levels and supporting evidence drawn directly from the complaint texts above."""
                
                raw = call_llm(ROOT_CAUSE_SYSTEM_PROMPT, user_prompt, retries=1)
                result = parse_json_response(raw)
                hypotheses = result.get("hypotheses", [])
                
                if hypotheses:
                    _persist_hypotheses(conn, cluster_id, hypotheses)
                    return hypotheses
            except Exception as e:
                print(f"  Gemini root cause failed ({e}), using offline fallback")
        
        # Offline fallback
        hypotheses = offline_root_cause(complaints, cluster_info)
        _persist_hypotheses(conn, cluster_id, hypotheses)
        return hypotheses


from datetime import datetime

def _persist_hypotheses(conn, cluster_id: str, hypotheses: List[dict]):
    """Save hypotheses to the database."""
    conn.execute("DELETE FROM root_cause_hypotheses WHERE cluster_id = ?", (cluster_id,))
    for i, h in enumerate(hypotheses):
        conn.execute("""
            INSERT INTO root_cause_hypotheses 
            (cluster_id, hypothesis_text, confidence_level, supporting_evidence, rank)
            VALUES (?, ?, ?, ?, ?)
        """, (
            cluster_id,
            h.get("hypothesis_text", ""),
            h.get("confidence_level", 0.5),
            json.dumps(h.get("supporting_evidence", [])),
            i + 1,
        ))


def generate_all_root_causes():
    """Generate root causes for all clusters."""
    with get_db() as conn:
        clusters = conn.execute("SELECT id FROM clusters").fetchall()
    
    for c in clusters:
        print(f"Generating root cause for {c['id']}...")
        hypotheses = generate_root_cause(c["id"])
        for h in hypotheses:
            conf = h.get("confidence_level", 0)
            print(f"  [{conf:.0%}] {h.get('hypothesis_text', '')[:80]}...")


if __name__ == "__main__":
    generate_all_root_causes()
