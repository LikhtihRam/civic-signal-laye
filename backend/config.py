"""CivicSentinel Configuration"""
import os
from pathlib import Path

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./civicsentinel.db")
DB_PATH = Path(__file__).parent / "civicsentinel.db"

# LLM Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
LLM_TEMPERATURE = 0.3
LLM_MAX_OUTPUT_TOKENS = 2048

# Clustering
GEO_CLUSTER_RADIUS_M = int(os.getenv("GEO_CLUSTER_RADIUS_M", "500"))
TEMPORAL_WINDOW_DAYS = int(os.getenv("TEMPORAL_WINDOW_DAYS", "30"))
DBSCAN_MIN_SAMPLES = 2

# Risk Scoring Weights
RISK_WEIGHTS = {
    "frequency": 0.25,
    "severity": 0.25,
    "recurrence": 0.20,
    "geo_concentration": 0.15,
    "safety_risk": 0.15,
}

# Risk Buckets
RISK_BUCKETS = {
    "Watch": (0, 40),
    "Elevated": (40, 60),
    "High-Risk": (60, 80),
    "Critical": (80, 100),
}

# Category Relation Map
CATEGORY_FAMILIES = {
    "water_infrastructure": ["water_leakage", "low_pressure", "water_supply", "road_flooding", "pipe_burst"],
    "drainage": ["drainage", "sewage", "waterlogging", "blocked_drain", "stagnant_water"],
    "roads": ["pothole", "road_damage", "road_flooding", "speed_bump", "road_crack"],
    "electricity": ["power_outage", "streetlight", "electrical_hazard", "transformer", "power_fluctuation"],
    "sanitation": ["garbage", "waste", "overflowing_bin", "open_defecation", "dead_animal", "foul_smell"],
    "public_health": ["contaminated_water", "disease_outbreak", "mosquito", "stagnant_water"],
}

# Reverse lookup: category -> family
CATEGORY_TO_FAMILY = {}
for family, categories in CATEGORY_FAMILIES.items():
    for cat in categories:
        CATEGORY_TO_FAMILY[cat] = family

# API
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
CORS_ORIGINS = ["*"]

# Demo scenario
DEMO_WARD = "Koramangala 4th Block"
DEMO_CATEGORY_FAMILY = "water_infrastructure"
