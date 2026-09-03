# CivicSentinel — AI-Powered Civic Intelligence Layer

> "Don't wait for the next complaint. Detect the problem behind it."

CivicSentinel sits on top of existing citizen grievance systems and converts fragmented, unstructured complaints into correlated, explainable early-warning signals for municipal authorities.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Dashboard (Vite + Tailwind + Leaflet + Glass)    │
│  Map View · Cluster List · Cluster Detail · Feedback    │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────┴────────────────────────────────┐
│  FastAPI Backend (Python)                               │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Ingestion │→ │ AI Extract│→ │ DBSCAN Clustering    │  │
│  └──────────┘  │ (Gemini/  │  │ (geo+temporal+categ) │  │
│                │  Offline) │  └──────────┬───────────┘  │
│                └──────────┘             │               │
│                          ┌──────────────┤               │
│                          ▼              ▼               │
│                ┌──────────────┐ ┌──────────────────┐    │
│                │ Root Cause   │ │ Explainable Risk  │    │
│                │ Hypothesis   │ │ Scoring Engine    │    │
│                └──────────────┘ └──────────────────┘    │
│                          │              │               │
│                          ▼              ▼               │
│                ┌──────────────────────────────────┐     │
│                │ Recommendation Generator (Gemini)│     │
│                └──────────────────────────────────┘     │
│                                                         │
│  SQLite Database · Pydantic Models · CORS Middleware    │
└─────────────────────────────────────────────────────────┘
```

## Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 18+ / Bun
- (Optional) Gemini API key for AI features

### 1. Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Seed data, run full pipeline, and start API server
python3 app.py
```

The API starts at `http://localhost:8000` (docs at `/docs`).

### 2. Frontend

```bash
# From project root
bun install
bun run dev
```

The frontend starts at `http://localhost:5173`.

### 3. Gemini API (Optional)

Set the environment variable to enable AI-powered extraction and root cause generation:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Without the API key, the system uses deterministic keyword-based extraction (still fully functional for the demo).

### 4. Run Full Pipeline Separately

```bash
cd backend
python3 pipeline.py
```

This regenerates seed data and reruns all processing.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check with counts |
| `GET` | `/api/stats` | Dashboard summary statistics |
| `POST` | `/api/ingest` | Ingest new complaint(s) |
| `POST` | `/api/process` | Run full extraction + clustering pipeline |
| `GET` | `/api/clusters` | List clusters (filterable by ward/category/risk) |
| `GET` | `/api/clusters/{id}` | Full cluster detail with all analysis |
| `POST` | `/api/clusters/{id}/feedback` | Authority feedback on cluster |
| `GET` | `/api/map-data` | Cluster centroids + member locations for map |
| `GET` | `/api/wards` | List wards with complaint counts |

## Data Model

- **Complaint** — Raw ingested citizen complaint text
- **StructuredComplaint** — AI-extracted structured signals (category, severity, sentiment)
- **Cluster** — Grouped related complaints (geo + temporal + categorical)
- **RootCauseHypothesis** — AI-generated hypotheses with confidence and evidence
- **RiskScore** — Weighted explainable risk score with full component breakdown
- **Recommendation** — Actionable suggestions for municipal authorities
- **ActionLog** — Authority feedback and resolution tracking

## Risk Scoring

The risk score is a transparent weighted function:

```
score = 0.25×frequency + 0.25×severity + 0.20×recurrence + 0.15×geo_concentration + 0.15×safety_risk
```

Each component is normalized to 0–100 and displayed with its individual contribution. Buckets:

| Bucket | Score Range | Action |
|--------|-------------|--------|
| Watch | 0–40 | Monitor |
| Elevated | 40–60 | Investigate |
| High-Risk | 60–80 | Immediate attention |
| Critical | 80+ | Emergency response |

## Demo Script (5 Steps)

### Step 1: See the raw data
```bash
cd backend
python3 -c "
import sqlite3, json
conn = sqlite3.connect('civicsentinel.db')
conn.row_factory = sqlite3.Row
# Show the 27-complaint water cluster
complaints = conn.execute('''
    SELECT c.raw_text, c.ward, sc.category, sc.severity
    FROM complaints c
    JOIN structured_complaints sc ON c.id = sc.complaint_id
    WHERE c.ward = \"Koramangala 4th Block\"
    AND sc.category IN (\"water_leakage\", \"low_pressure\", \"road_flooding\")
    LIMIT 5
''').fetchall()
for c in complaints:
    print(f'[{c[\"severity\"]}] {c[\"raw_text\"][:100]}...')
"
```

### Step 2: See the cluster
```bash
curl -s http://localhost:8000/api/clusters | python3 -m json.tool | head -30
```

### Step 3: See root cause analysis
```bash
# Get the top cluster ID, then:
curl -s http://localhost:8000/api/clusters/CL-XXXXX | python3 -m json.tool
```
Shows: root cause hypotheses with confidence levels and supporting evidence phrases.

### Step 4: See the risk score breakdown
The cluster detail endpoint returns the full risk breakdown showing each component's contribution.

### Step 5: See the recommendation
Same cluster detail shows the recommended action, responsible department, and draft public advisory.

## Design Principles

1. **Explainability First** — Every AI output shows *why* using real evidence from underlying complaints
2. **Augment, Don't Replace** — Decision-support layer for human authorities, not autonomous action
3. **API-First** — Plug into any existing grievance platform via REST
4. **Privacy** — PII (names, phone numbers) stripped before LLM processing
5. **Glassmorphism UI** — Clean, professional municipal dashboard aesthetic

## Tech Stack

- **Backend**: Python 3.10, FastAPI, SQLite, scikit-learn (DBSCAN)
- **AI**: Gemini API (with offline keyword fallback)
- **Frontend**: React 19, TypeScript, Tailwind CSS, Leaflet, Framer Motion
- **Styling**: Light Glassmorphism (translucent panels, blur, subtle gradients)

## Project Structure

```
├── backend/
│   ├── app.py            # FastAPI server
│   ├── config.py         # Configuration
│   ├── database.py       # SQLite schema & connection
│   ├── models.py         # Data models
│   ├── seed.py           # Synthetic data generator (250 complaints)
│   ├── ingest.py         # CSV → database ingestion
│   ├── llm_client.py     # Gemini abstraction layer
│   ├── extraction.py     # AI extraction (structured signals)
│   ├── clustering.py     # DBSCAN geo-temporal clustering
│   ├── root_cause.py     # Root cause hypothesis generation
│   ├── risk_scoring.py   # Explainable risk scoring
│   ├── recommendation.py # Recommendation generation
│   ├── pipeline.py       # Full pipeline runner
│   └── requirements.txt  # Python dependencies
├── src/
│   ├── main.tsx          # App entrypoint & routes
│   ├── index.css         # Glassmorphism theme + Tailwind
│   ├── lib/api.ts        # API client
│   ├── lib/constants.ts  # Colors, labels, utilities
│   └── pages/
│       ├── Landing.tsx        # Public landing page
│       ├── Dashboard.tsx      # Map + stats dashboard
│       ├── Clusters.tsx       # Filterable cluster list
│       ├── ClusterDetail.tsx  # Full cluster analysis
│       └── NotFound.tsx       # 404 page
└── README.md
```
