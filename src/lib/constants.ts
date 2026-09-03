export const RISK_COLORS: Record<string, string> = {
  Watch: "#3b82f6",
  Elevated: "#f59e0b",
  "High-Risk": "#ef4444",
  Critical: "#dc2626",
};

export const RISK_BG_COLORS: Record<string, string> = {
  Watch: "rgba(59, 130, 246, 0.12)",
  Elevated: "rgba(245, 158, 11, 0.12)",
  "High-Risk": "rgba(239, 68, 68, 0.12)",
  Critical: "rgba(220, 38, 38, 0.12)",
};

export const CATEGORY_ICONS: Record<string, string> = {
  water_infrastructure: "💧",
  drainage: "🌊",
  roads: "🛤️",
  electricity: "⚡",
  sanitation: "🗑️",
  public_health: "🏥",
  other: "📋",
};

export const CATEGORY_LABELS: Record<string, string> = {
  water_infrastructure: "Water Infrastructure",
  drainage: "Drainage",
  roads: "Roads",
  electricity: "Electricity",
  sanitation: "Sanitation",
  public_health: "Public Health",
  other: "Other",
};

export const SEVERITY_COLORS: Record<string, string> = {
  Low: "#6b7280",
  Medium: "#3b82f6",
  High: "#f59e0b",
  Critical: "#ef4444",
};

export function formatCategory(cat: string): string {
  return CATEGORY_LABELS[cat] || cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function riskScoreToColor(score: number): string {
  if (score >= 80) return RISK_COLORS.Critical;
  if (score >= 60) return RISK_COLORS["High-Risk"];
  if (score >= 40) return RISK_COLORS.Elevated;
  return RISK_COLORS.Watch;
}
