"""LLM abstraction layer — wraps Gemini API with defensive parsing and retry logic.

This module provides a clean abstraction so the model can be swapped later.
When GEMINI_API_KEY is not set, it falls back to deterministic offline extraction
so the rest of the pipeline can still be demonstrated.
"""
import json
import os
import re
import time
from typing import Optional
from config import GEMINI_API_KEY, GEMINI_MODEL, LLM_TEMPERATURE, LLM_MAX_OUTPUT_TOKENS


def _strip_pii(text: str) -> str:
    """Strip/mask citizen PII before sending to LLM."""
    # Mask phone numbers
    text = re.sub(r'(\+91[\s-]?)?\d{10}', '[PHONE_MASKED]', text)
    text = re.sub(r'\d{5}\s?\d{5}', '[PHONE_MASKED]', text)
    # Mask email addresses
    text = re.sub(r'\b[\w.+-]+@[\w-]+\.[\w.-]+\b', '[EMAIL_MASKED]', text)
    # Mask names after common prefixes (basic heuristic)
    text = re.sub(r'(?i)(my name is|i am|this is)(\s+[A-Z][a-z]+)', lambda m: m.group(1) + ' [NAME_MASKED]', text)
    return text


def call_gemini(system_prompt: str, user_prompt: str) -> str:
    """Call Gemini API and return raw text response."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not set. Set it in environment to enable AI features.")
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=system_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=LLM_TEMPERATURE,
                max_output_tokens=LLM_MAX_OUTPUT_TOKENS,
            ),
        )
        response = model.generate_content(user_prompt)
        return response.text
    except ImportError:
        # Fallback to REST API
        import urllib.request
        import urllib.error
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
            "generationConfig": {
                "temperature": LLM_TEMPERATURE,
                "maxOutputTokens": LLM_MAX_OUTPUT_TOKENS,
            },
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["candidates"][0]["content"]["parts"][0]["text"]


def call_llm(system_prompt: str, user_prompt: str, retries: int = 1) -> str:
    """Call LLM with retry logic for malformed responses."""
    last_error = None
    for attempt in range(retries + 1):
        try:
            raw = call_gemini(system_prompt, user_prompt)
            return raw
        except Exception as e:
            last_error = e
            if attempt < retries:
                time.sleep(1)
    raise RuntimeError(f"LLM call failed after {retries + 1} attempts: {last_error}")


def parse_json_response(raw: str) -> dict:
    """Parse JSON from LLM response, handling markdown fences and preamble text."""
    text = raw.strip()
    
    # Remove markdown code fences
    text = re.sub(r'^```(?:json)?\s*\n?', '', text)
    text = re.sub(r'\n?```\s*$', '', text)
    
    # Try to find JSON object in the text
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        text = json_match.group(0)
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try fixing common issues
        text = text.replace("'", '"')
        text = re.sub(r',\s*}', '}', text)
        text = re.sub(r',\s*]', ']', text)
        return json.loads(text)


# --- Offline / Fallback Extraction ---

CATEGORY_KEYWORDS = {
    "water_leakage": ["water", "leak", "leakage", "pipe", "burst", "seepage", "dripping", "gushing"],
    "low_pressure": ["pressure", "low pressure", "trickle", "barely", "flow"],
    "road_flooding": ["flood", "flooding", "submerged", "waterlogged", "knee-deep"],
    "drainage": ["drain", "drainage", "overflow", "sewage", "blocked"],
    "blocked_drain": ["blocked", "clogged", "drain", "overflowing"],
    "waterlogging": ["waterlogged", "water logging", "stagnant", "accumulates"],
    "sewage": ["sewage", "septic", "raw sewage", "foul", "backflow"],
    "pothole": ["pothole", "potholes", "broken road", "crater", "road damage"],
    "road_damage": ["road damage", "breaking apart", "surface", "cracking"],
    "road_crack": ["crack", "cracks", "foundation", "shifting"],
    "power_outage": ["power cut", "outage", "electricity", "no power", "power goes"],
    "streetlight": ["streetlight", "street light", "dark", "not working"],
    "electrical_hazard": ["wire", "hanging", "electric", "electrocution", "exposed"],
    "transformer": ["transformer", "buzzing", "sparks", "explode"],
    "power_fluctuation": ["voltage", "fluctuation", "damaged appliance"],
    "garbage": ["garbage", "waste", "trash", "collection"],
    "waste": ["waste", "dumped", "debris"],
    "overflowing_bin": ["bin", "overflowing", "dustbin"],
    "open_defecation": ["defecation", "open area", "toilets"],
    "dead_animal": ["dead", "animal", "decomposing", "carcass"],
    "foul_smell": ["smell", "stink", "stench", "odour"],
    "contaminated_water": ["contaminated", "discolored", "brown", "muddy"],
    "disease_outbreak": ["disease", "illness", "hospital", "outbreak", "sick"],
    "mosquito": ["mosquito", "dengue", "breeding"],
}


def offline_extract(text: str, metadata: dict) -> dict:
    """Deterministic keyword-based extraction when Gemini is unavailable."""
    text_lower = text.lower()
    
    # Detect category
    best_category = "other"
    best_score = 0
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > best_score:
            best_score = score
            best_category = cat
    
    # Detect severity from keywords
    if any(w in text_lower for w in ["dangerous", "collapse", "explode", "electrocution", "injured", "hospital"]):
        severity = "Critical"
    elif any(w in text_lower for w in ["very dangerous", "multiple", "accident", "major", "gushing", "raw sewage", "contamination"]):
        severity = "High"
    elif any(w in text_lower for w in ["terrible", "worst", "weeks", "months", "overflowing", "stinking"]):
        severity = "Medium"
    else:
        severity = "Low"
    
    # Urgency
    urgency_words = ["urgent", "immediately", "dangerous", "collapse", "explode", "injured", "children", "school"]
    urgency = any(w in text_lower for w in urgency_words)
    
    # Affected population estimate
    pop_words = ["colony", "apartment", "complex", "area", "ward", "multiple", "entire"]
    affected = sum(1 for w in pop_words if w in text_lower)
    affected_pop = min(max(affected * 50, 100), 5000)
    
    # Sentiment
    negative = sum(1 for w in ["ignored", "terrible", "worst", "frustrated", "dangerous", "risk", "hazard"] if w in text_lower)
    if negative >= 3:
        sentiment = "angry"
    elif negative >= 2:
        sentiment = "frustrated"
    elif negative >= 1:
        sentiment = "concerned"
    else:
        sentiment = "neutral"
    
    return {
        "location": metadata.get("ward", "Unknown"),
        "category": best_category,
        "severity": severity,
        "urgency_flag": urgency,
        "affected_population_estimate": affected_pop,
        "sentiment": sentiment,
    }
