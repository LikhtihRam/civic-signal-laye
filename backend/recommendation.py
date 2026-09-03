"""Recommendation Generator — produces actionable recommendations for authorities."""
import json
from typing import List, Dict, Optional
from database import get_db, parse_json_field
from llm_client import call_llm, parse_json_response, _strip_pii
from config import GEMINI_API_KEY

RECOMMENDATION_SYSTEM_PROMPT = """You are a municipal operations advisor AI. Given a complaint cluster with root cause analysis, generate actionable recommendations for authorities.

You MUST respond with ONLY valid JSON — no markdown, no preamble.

Return exactly this structure:
{
  "suggested_action": "Clear, specific action the authorities should take",
  "department": "Name of the responsible department (e.g., Water Supply, Roads & Infrastructure, Electricity Board, Sanitation)",
  "priority": "Immediate|Within 48 hours|Within 1 week|Scheduled maintenance",
  "response_window": "Specific time window for response (e.g., '24 hours', '48 hours', '1 week')",
  "draft_advisory_text": "Brief public advisory text that could be shared with affected residents"
}

Rules:
- Be specific and actionable, not generic
- The department should be realistic for Indian municipal governance
- Priority should match the risk level and nature of the issue
- The advisory text should be empathetic, clear, and informative
- Consider both immediate fix and long-term prevention"""


def offline_recommendation(cluster_info: dict, hypotheses: list, risk_score: dict) -> dict:
    """Generate offline recommendations based on category and risk."""
    category = cluster_info.get("category_family", "other")
    ward = cluster_info.get("ward", "unknown")
    risk_bucket = risk_score.get("risk_bucket", "Watch")
    complaint_count = risk_score.get("complaint_count", 0)
    
    recommendations_map = {
        "water_infrastructure": {
            "department": "Water Supply & Sewerage Board",
            "suggested_action": f"Conduct emergency pipeline inspection in {ward} using leak detection equipment. Deploy repair crew to fix identified burst/broken pipes. Assess the age and condition of the distribution network serving this area.",
        },
        "drainage": {
            "department": "Storm Water & Drainage Division",
            "suggested_action": f"Immediate drain clearing operation in {ward}. Deploy jetting machines to flush blocked drains. Conduct survey of drainage capacity vs. current load. Schedule desilting before next rainfall event.",
        },
        "roads": {
            "department": "Roads & Infrastructure",
            "suggested_action": f"Emergency road repair crew deployment to {ward}. Priority pothole filling and surface restoration. Investigate underlying drainage issues that may be causing road damage.",
        },
        "electricity": {
            "department": "Electricity Supply Company (ESCOM)",
            "suggested_action": f"Technical inspection of electrical infrastructure in {ward}. Check transformer health, cable condition, and load distribution. Address any exposed/hanging wires immediately.",
        },
        "sanitation": {
            "department": "Solid Waste Management",
            "suggested_action": f"Increase garbage collection frequency in {ward}. Clear overflowing bins. Investigate and address any open dumping sites. Deploy additional collection vehicles.",
        },
        "public_health": {
            "department": "Public Health Department",
            "suggested_action": f"Health surveillance in {ward}. Conduct vector control measures (fogging, larviciding). Test water quality. Issue public health advisory if warranted.",
        },
    }
    
    dept_info = recommendations_map.get(category, {
        "department": "General Municipal Services",
        "suggested_action": f"Investigate and address infrastructure issues in {ward} identified by multiple citizen complaints.",
    })
    
    # Priority based on risk
    if risk_bucket == "Critical":
        priority = "Immediate"
        response_window = "24 hours"
    elif risk_bucket == "High-Risk":
        priority = "Within 48 hours"
        response_window = "48 hours"
    elif risk_bucket == "Elevated":
        priority = "Within 1 week"
        response_window = "5-7 days"
    else:
        priority = "Scheduled maintenance"
        response_window = "2 weeks"
    
    # Advisory text
    advisory_templates = {
        "water_infrastructure": f"Attention residents of {ward}: We have received {complaint_count} reports of water supply issues in your area. Our water supply team has been dispatched to inspect and repair the affected infrastructure. We apologize for the inconvenience and request patience while our crews work to restore normal service. For urgent concerns, please contact the Water Supply helpline.",
        "drainage": f"Attention residents of {ward}: We have received {complaint_count} reports of drainage issues in your area. Our drainage maintenance team has been deployed to clear blocked drains and address waterlogging. Please avoid wading through stagnant water. If you notice exposed drains, please keep children away from the area.",
        "roads": f"Attention residents of {ward}: We have received {complaint_count} reports of road damage in your area. Our road maintenance team will be conducting emergency repairs. Please use caution while traveling on affected roads and consider alternate routes where possible.",
    }
    
    advisory = advisory_templates.get(category, 
        f"Attention residents of {ward}: We have received {complaint_count} reports related to {category.replace('_', ' ')} issues in your area. Our teams have been notified and will address these concerns. Thank you for bringing this to our attention.")
    
    return {
        "suggested_action": dept_info["suggested_action"],
        "department": dept_info["department"],
        "priority": priority,
        "response_window": response_window,
        "draft_advisory_text": advisory,
    }


def generate_recommendation(cluster_id: str) -> Optional[dict]:
    """Generate recommendation for a cluster."""
    with get_db() as conn:
        cluster = conn.execute("SELECT * FROM clusters WHERE id = ?", (cluster_id,)).fetchone()
        if not cluster:
            return None
        
        cluster = dict(cluster)
        
        # Get risk score
        risk = conn.execute("SELECT * FROM risk_scores WHERE cluster_id = ?", (cluster_id,)).fetchone()
        risk_score = dict(risk) if risk else {"risk_bucket": "Watch", "complaint_count": 0}
        
        # Get root causes
        hypotheses = conn.execute(
            "SELECT * FROM root_cause_hypotheses WHERE cluster_id = ? ORDER BY rank", 
            (cluster_id,)
        ).fetchall()
        hypotheses = [dict(h) for h in hypotheses]
        
        member_ids = json.loads(cluster.get("member_complaint_ids", "[]"))
        
        cluster_info = {
            "category_family": cluster.get("category_family", "unknown"),
            "ward": cluster.get("ward", "unknown"),
            "member_count": len(member_ids),
        }
        
        # Try Gemini
        if GEMINI_API_KEY:
            try:
                root_cause_text = "\n".join([
                    f"  - {h['hypothesis_text']} (confidence: {h['confidence_level']:.0%})"
                    for h in hypotheses[:3]
                ]) or "No root cause analysis available yet."
                
                user_prompt = f"""Cluster Details:
- Ward: {cluster_info['ward']}
- Category: {cluster_info['category_family']}
- Complaint count: {len(member_ids)}
- Risk level: {risk_score.get('risk_bucket', 'Unknown')}

Root Cause Hypotheses:
{root_cause_text}

Generate specific, actionable recommendations for municipal authorities."""
                
                raw = call_llm(RECOMMENDATION_SYSTEM_PROMPT, user_prompt, retries=1)
                result = parse_json_response(raw)
                
                # Validate
                required = ["suggested_action", "department", "priority"]
                if all(k in result for k in required):
                    _persist_recommendation(conn, cluster_id, result)
                    return result
                    
            except Exception as e:
                print(f"  Gemini recommendation failed ({e}), using offline")
        
        # Offline fallback
        result = offline_recommendation(cluster_info, hypotheses, risk_score)
        _persist_recommendation(conn, cluster_id, result)
        return result


def _persist_recommendation(conn, cluster_id: str, rec: dict):
    """Save recommendation to the database."""
    conn.execute("""
        INSERT OR REPLACE INTO recommendations
        (cluster_id, suggested_action, department, priority, response_window, draft_advisory_text)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        cluster_id,
        rec.get("suggested_action", ""),
        rec.get("department", ""),
        rec.get("priority", ""),
        rec.get("response_window", ""),
        rec.get("draft_advisory_text", ""),
    ))


def generate_all_recommendations():
    """Generate recommendations for all clusters."""
    with get_db() as conn:
        clusters = conn.execute("SELECT id FROM clusters").fetchall()
    
    for c in clusters:
        print(f"Generating recommendation for {c['id']}...")
        rec = generate_recommendation(c["id"])
        if rec:
            print(f"  Department: {rec.get('department', 'N/A')}")
            print(f"  Priority: {rec.get('priority', 'N/A')}")


if __name__ == "__main__":
    generate_all_recommendations()
