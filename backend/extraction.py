"""AI Extraction Layer — converts raw complaint text into structured civic signals."""
import json
from typing import Optional
from llm_client import call_llm, parse_json_response, offline_extract, _strip_pii, GEMINI_API_KEY
from database import get_db, row_to_dict

EXTRACTION_SYSTEM_PROMPT = """You are a civic complaint analysis AI. Extract structured information from citizen complaint texts.

You MUST respond with ONLY valid JSON — no markdown fences, no preamble, no explanation.

Return exactly this JSON structure:
{
  "location": "extracted location name or ward if not specified",
  "category": "one of: water_leakage, low_pressure, road_flooding, drainage, blocked_drain, waterlogging, sewage, pothole, road_damage, road_crack, power_outage, streetlight, electrical_hazard, transformer, power_fluctuation, garbage, waste, overflowing_bin, open_defecation, dead_animal, foul_smell, contaminated_water, disease_outbreak, mosquito",
  "severity": "Low|Medium|High|Critical",
  "urgency_flag": true or false,
  "affected_population_estimate": <number>,
  "sentiment": "one of: neutral, concerned, frustrated, angry, urgent"
}

Severity guidelines:
- Critical: imminent danger to life, infrastructure collapse risk, disease outbreak, electrical hazard
- High: widespread issue, multiple people affected, health risk, significant damage
- Medium: ongoing problem affecting daily life, no immediate danger
- Low: minor inconvenience, aesthetic issue

Urgency is true if: safety hazard, children at risk, emergency, getting worse rapidly.
Estimate affected population based on area description (colony = ~200, ward = ~5000, street = ~50)."""


def extract_complaint_signals(raw_text: str, metadata: dict) -> dict:
    """Extract structured signals from a raw complaint using Gemini API.
    
    Falls back to keyword-based extraction if GEMINI_API_KEY is not set.
    """
    # Strip PII before sending to LLM
    cleaned_text = _strip_pii(raw_text)
    
    if not GEMINI_API_KEY:
        return offline_extract(cleaned_text, metadata)
    
    user_prompt = f"""Complaint text: "{cleaned_text}"
Source: {metadata.get('source_platform', 'unknown')}
Ward: {metadata.get('ward', 'unknown')}
Timestamp: {metadata.get('timestamp', 'unknown')}"""
    
    try:
        raw_response = call_llm(EXTRACTION_SYSTEM_PROMPT, user_prompt, retries=1)
        result = parse_json_response(raw_response)
        
        # Validate required fields
        required = ["category", "severity", "urgency_flag"]
        for field in required:
            if field not in result:
                raise ValueError(f"Missing required field: {field}")
        
        # Validate severity
        if result["severity"] not in ["Low", "Medium", "High", "Critical"]:
            result["severity"] = "Medium"
        
        # Set defaults
        result.setdefault("location", metadata.get("ward", "Unknown"))
        result.setdefault("affected_population_estimate", 100)
        result.setdefault("sentiment", "neutral")
        result.setdefault("urgency_flag", False)
        
        return result
        
    except Exception as e:
        print(f"  Gemini extraction failed ({e}), using offline fallback")
        return offline_extract(cleaned_text, metadata)


def process_all_complaints(batch_size: int = 50):
    """Process all unstructured complaints through the extraction pipeline."""
    with get_db() as conn:
        # Get complaints not yet structured
        unprocessed = conn.execute("""
            SELECT c.* FROM complaints c 
            LEFT JOIN structured_complaints sc ON c.id = sc.complaint_id 
            WHERE sc.complaint_id IS NULL
            ORDER BY c.timestamp
        """).fetchall()
        
        if not unprocessed:
            print("All complaints already processed.")
            return 0
        
        print(f"Processing {len(unprocessed)} complaints through extraction...")
        count = 0
        
        for row in unprocessed:
            complaint = dict(row)
            metadata = {
                "source_platform": complaint["source_platform"],
                "ward": complaint["ward"],
                "timestamp": complaint["timestamp"],
            }
            
            signals = extract_complaint_signals(complaint["raw_text"], metadata)
            
            conn.execute("""
                INSERT OR REPLACE INTO structured_complaints
                (complaint_id, extracted_location, category, severity, urgency_flag, 
                 affected_population_estimate, sentiment)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                complaint["id"],
                signals.get("location", ""),
                signals["category"],
                signals["severity"],
                1 if signals["urgency_flag"] else 0,
                signals.get("affected_population_estimate", 100),
                signals.get("sentiment", "neutral"),
            ))
            
            count += 1
            if count % batch_size == 0:
                print(f"  Processed {count}/{len(unprocessed)}...")
        
        print(f"Extraction complete: {count} complaints structured.")
        return count


if __name__ == "__main__":
    process_all_complaints()
