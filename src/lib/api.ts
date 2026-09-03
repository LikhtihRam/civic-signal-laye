const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface Cluster {
  id: string;
  member_complaint_ids: string[];
  member_count: number;
  centroid_lat: number;
  centroid_long: number;
  ward: string;
  category_family: string;
  time_window_start: string;
  time_window_end: string;
  status: string;
  total_score: number | null;
  risk_bucket: string | null;
  frequency_score?: number;
  severity_score?: number;
  safety_score?: number;
}

export interface ClusterDetail extends Cluster {
  member_complaints: Complaint[];
  risk_score: RiskScore | null;
  root_causes: RootCause[];
  recommendation: Recommendation | null;
  action_log: ActionLog[];
}

export interface Complaint {
  id: string;
  raw_text: string;
  timestamp: string;
  lat: number;
  long: number;
  ward: string;
  category: string;
  category_raw: string;
  severity: string;
  urgency_flag: number;
  sentiment: string;
  affected_population_estimate: number;
}

export interface RiskScore {
  cluster_id: string;
  total_score: number;
  risk_bucket: string;
  frequency_score: number;
  severity_score: number;
  recurrence_score: number;
  geo_concentration_score: number;
  safety_score: number;
  breakdown: Record<string, {
    score: number;
    weight: number;
    contribution: number;
    detail: string;
  }>;
}

export interface RootCause {
  id: number;
  cluster_id: string;
  hypothesis_text: string;
  confidence_level: number;
  supporting_evidence: string[];
  rank: number;
}

export interface Recommendation {
  cluster_id: string;
  suggested_action: string;
  department: string;
  priority: string;
  response_window: string;
  draft_advisory_text: string;
}

export interface ActionLog {
  id: number;
  cluster_id: string;
  authority_id: string;
  action_taken: string;
  actual_root_cause: string;
  status_update: string;
  outcome_notes: string;
  created_at: string;
}

export interface MapData {
  cluster_id: string;
  centroid_lat: number;
  centroid_long: number;
  ward: string;
  category_family: string;
  member_count: number;
  risk_score: number;
  risk_bucket: string;
  complaint_locations: { lat: number; long: number; ward: string }[];
}

export interface Stats {
  total_complaints: number;
  total_clusters: number;
  urgent_complaints: number;
  critical_complaints: number;
  risk_distribution: Record<string, number>;
  ward_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  health: () => fetchJson<{ status: string; complaints: number; clusters: number }>("/api/health"),
  
  stats: () => fetchJson<Stats>("/api/stats"),
  
  mapData: () => fetchJson<{ clusters: MapData[] }>("/api/map-data"),
  
  clusters: (params?: { ward?: string; category?: string; risk_level?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.ward) searchParams.set("ward", params.ward);
    if (params?.category) searchParams.set("category", params.category);
    if (params?.risk_level) searchParams.set("risk_level", params.risk_level);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return fetchJson<{ clusters: Cluster[]; total: number }>(`/api/clusters${qs ? `?${qs}` : ""}`);
  },
  
  clusterDetail: (id: string) => fetchJson<ClusterDetail>(`/api/clusters/${id}`),
  
  wards: () => fetchJson<{ wards: { ward: string; complaint_count: number }[] }>("/api/wards"),
  
  submitFeedback: (clusterId: string, data: { status: string; actual_root_cause?: string; outcome_notes?: string }) =>
    fetchJson<{ status: string; cluster_id: string; updated_status: string }>(`/api/clusters/${clusterId}/feedback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
