/**
 * Gemini API client for CivicSentinel frontend.
 * Calls Google's Gemini API directly from the browser using the REST endpoint.
 * API key is stored in localStorage — never sent to any third-party server.
 */

const GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string | null {
  return localStorage.getItem("civicsentinel_gemini_key");
}

export function setGeminiKey(key: string) {
  localStorage.setItem("civicsentinel_gemini_key", key);
}

export function getGeminiKey(): string | null {
  return getApiKey();
}

export function clearGeminiKey() {
  localStorage.removeItem("civicsentinel_gemini_key");
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Gemini API key not configured. Go to Settings to add it.");

  const url = `${GEMINI_REST_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function parseJson(raw: string): Record<string, unknown> {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  const match = text.match(/\{[\s\S]*\}/);
  if (match) text = match[0];
  try {
    return JSON.parse(text);
  } catch {
    text = text.replace(/'/g, '"').replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    return JSON.parse(text);
  }
}

/* ------------------------------------------------------------------ */
/*  Extraction: classify complaint text into structured signals       */
/* ------------------------------------------------------------------ */

const EXTRACTION_SYSTEM = `You are a civic complaint analysis AI. Extract structured information from citizen complaint texts.

Return ONLY valid JSON — no markdown, no preamble:
{
  "category": "one of: water_leakage, low_pressure, road_flooding, drainage, blocked_drain, waterlogging, sewage, pothole, road_damage, road_crack, power_outage, streetlight, electrical_hazard, transformer, power_fluctuation, garbage, waste, overflowing_bin, open_defecation, dead_animal, foul_smell, contaminated_water, disease_outbreak, mosquito",
  "severity": "Low|Medium|High|Critical",
  "urgency_flag": true/false,
  "affected_population_estimate": <number>,
  "sentiment": "neutral|concerned|frustrated|angry|urgent",
  "estimated_days": <number of days to resolve, realistic for Indian municipal governance>,
  "summary": "one-line summary of the complaint"
}

Severity: Critical=danger to life, High=widespread/health risk, Medium=ongoing daily issue, Low=minor.
Estimated days: Critical=1-3, High=3-7, Medium=7-14, Low=14-30. Adjust for scope.`;

export interface ExtractedSignals {
  category: string;
  severity: string;
  urgency_flag: boolean;
  affected_population_estimate: number;
  sentiment: string;
  estimated_days: number;
  summary: string;
}

const FALLBACK_SIGNALS: Record<string, ExtractedSignals> = {
  water_leakage: { category: "water_leakage", severity: "High", urgency_flag: true, affected_population_estimate: 500, sentiment: "frustrated", estimated_days: 5, summary: "Water leakage reported" },
  low_pressure: { category: "low_pressure", severity: "Medium", urgency_flag: false, affected_population_estimate: 300, sentiment: "concerned", estimated_days: 10, summary: "Low water pressure issue" },
  pothole: { category: "pothole", severity: "High", urgency_flag: true, affected_population_estimate: 200, sentiment: "angry", estimated_days: 7, summary: "Road pothole hazard" },
  drainage: { category: "drainage", severity: "Medium", urgency_flag: false, affected_population_estimate: 400, sentiment: "concerned", estimated_days: 12, summary: "Drainage issue reported" },
  power_outage: { category: "power_outage", severity: "High", urgency_flag: true, affected_population_estimate: 1000, sentiment: "frustrated", estimated_days: 3, summary: "Power outage reported" },
};

export async function extractSignals(rawText: string, ward: string): Promise<ExtractedSignals> {
  try {
    const raw = await callGemini(
      EXTRACTION_SYSTEM,
      `Complaint text: "${rawText}"\nWard: ${ward}\nTimestamp: ${new Date().toISOString()}`
    );
    const result = parseJson(raw);
    return {
      category: String(result.category || "other"),
      severity: ["Low", "Medium", "High", "Critical"].includes(String(result.severity))
        ? String(result.severity) : "Medium",
      urgency_flag: Boolean(result.urgency_flag),
      affected_population_estimate: Number(result.affected_population_estimate) || 200,
      sentiment: String(result.sentiment || "neutral"),
      estimated_days: Math.max(1, Math.min(30, Number(result.estimated_days) || 7)),
      summary: String(result.summary || rawText.substring(0, 100)),
    };
  } catch {
    // Offline fallback — keyword-based
    const lower = rawText.toLowerCase();
    const matchedKey = Object.keys(FALLBACK_SIGNALS).find((k) =>
      lower.includes(k.replace(/_/g, " "))
    );
    const base = matchedKey
      ? FALLBACK_SIGNALS[matchedKey]
      : { category: "other", severity: "Medium", urgency_flag: false, affected_population_estimate: 200, sentiment: "neutral", estimated_days: 10, summary: rawText.substring(0, 100) };
    // Adjust severity from keywords
    if (/\b(danger|collapse|explode|injur|hospital|electroc)\b/i.test(lower)) {
      return { ...base, severity: "Critical", urgency_flag: true, estimated_days: 2 };
    }
    if (/\b(major|widespread|health|week|month|overflow)\b/i.test(lower)) {
      return { ...base, severity: "High", urgency_flag: base.urgency_flag, estimated_days: Math.min(base.estimated_days, 7) };
    }
    return base;
  }
}

/* ------------------------------------------------------------------ */
/*  Root cause + ETA for an existing complaint                         */
/* ------------------------------------------------------------------ */

const ROOT_CAUSE_SYSTEM = `You are a municipal infrastructure analyst. Given a citizen complaint, generate:
1. A probable root cause (1-2 sentences)
2. An estimated resolution time in days (realistic for Indian municipal governance)
3. The responsible department
4. A brief explanation of why the ETA is what it is

Return ONLY valid JSON:
{
  "root_cause": "probable root cause explanation",
  "estimated_days": <number>,
  "department": "responsible department name",
  "eta_reasoning": "brief explanation of the timeline estimate"
}`;

export interface RootCauseEstimate {
  root_cause: string;
  estimated_days: number;
  department: string;
  eta_reasoning: string;
}

const DEPT_MAP: Record<string, string> = {
  water_leakage: "Water Supply & Sewerage Board",
  low_pressure: "Water Supply & Sewerage Board",
  road_flooding: "Storm Water & Drainage",
  drainage: "Storm Water & Drainage",
  blocked_drain: "Storm Water & Drainage",
  waterlogging: "Storm Water & Drainage",
  sewage: "Sewerage Board",
  pothole: "Roads & Infrastructure",
  road_damage: "Roads & Infrastructure",
  power_outage: "Electricity Supply Company (ESCOM)",
  streetlight: "Electricity Supply Company (ESCOM)",
  electrical_hazard: "Electricity Supply Company (ESCOM)",
  garbage: "Solid Waste Management",
  waste: "Solid Waste Management",
  overflowing_bin: "Solid Waste Management",
};

const ETA_MAP: Record<string, number> = {
  water_leakage: 5, low_pressure: 10, road_flooding: 4, drainage: 8,
  blocked_drain: 6, waterlogging: 5, sewage: 3, pothole: 7,
  road_damage: 10, power_outage: 3, streetlight: 10, electrical_hazard: 2,
  garbage: 5, waste: 4, overflowing_bin: 4,
};

export async function getRootCauseEstimate(
  rawText: string,
  category: string,
  severity: string
): Promise<RootCauseEstimate> {
  try {
    const raw = await callGemini(
      ROOT_CAUSE_SYSTEM,
      `Complaint: "${rawText}"\nCategory: ${category}\nSeverity: ${severity}`
    );
    const result = parseJson(raw);
    return {
      root_cause: String(result.root_cause || "Under investigation"),
      estimated_days: Math.max(1, Math.min(30, Number(result.estimated_days) || 7)),
      department: String(result.department || DEPT_MAP[category] || "Municipal Services"),
      eta_reasoning: String(result.eta_reasoning || "Estimated based on similar resolved complaints"),
    };
  } catch {
    return {
      root_cause: `Likely ${category.replace(/_/g, " ")} issue requiring inspection and repair`,
      estimated_days: ETA_MAP[category] || 10,
      department: DEPT_MAP[category] || "Municipal Services",
      eta_reasoning: "Estimated based on typical resolution timelines for this category",
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Notification check — has the issue been resolved?                  */
/* ------------------------------------------------------------------ */

export interface ResolutionNotification {
  complaintId: string;
  message: string;
  resolvedAt: string;
}

export function checkForNotifications(): ResolutionNotification[] {
  const raw = localStorage.getItem("civicsentinel_notifications") || "[]";
  return JSON.parse(raw);
}

export function addNotification(n: ResolutionNotification) {
  const existing = checkForNotifications();
  // Avoid duplicates
  if (existing.some((x) => x.complaintId === n.complaintId)) return;
  existing.unshift(n);
  localStorage.setItem("civicsentinel_notifications", JSON.stringify(existing));
}

export function clearNotification(complaintId: string) {
  const existing = checkForNotifications().filter((n) => n.complaintId !== complaintId);
  localStorage.setItem("civicsentinel_notifications", JSON.stringify(existing));
}
