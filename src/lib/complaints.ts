/**
 * Complaint storage utilities.
 * Manages the localStorage-backed complaint store with extended fields:
 * - estimated_days: AI-generated resolution timeline
 * - root_cause: AI-generated probable cause
 * - department: responsible department
 * - status: submitted | processing | acknowledged | in_progress | resolved | confirmed_closed
 * - notifications: array of status change events
 */

export interface FiledComplaint {
  id: string;
  raw_text: string;
  timestamp: string;
  ward: string;
  category: string;
  severity: string;
  lat: number | null;
  long: number | null;
  status: "submitted" | "processing" | "acknowledged" | "in_progress" | "resolved" | "confirmed_closed";
  // AI-enriched fields
  summary?: string;
  sentiment?: string;
  urgency_flag?: boolean;
  estimated_days?: number;
  estimated_date?: string; // ISO date string
  root_cause?: string;
  department?: string;
  eta_reasoning?: string;
  affected_population_estimate?: number;
  // Resolution tracking
  resolved_at?: string;
  confirmed_at?: string;
  resolution_notes?: string;
  notifications: NotificationEvent[];
}

export interface NotificationEvent {
  id: string;
  type: "status_change" | "resolved" | "eta_updated";
  message: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = "civicsentinel_complaints";
const NOTIF_KEY = "civicsentinel_notifications";

export function getComplaints(): FiledComplaint[] {
  const raw = localStorage.getItem(STORAGE_KEY) || "[]";
  return JSON.parse(raw);
}

export function saveComplaint(c: FiledComplaint) {
  const all = getComplaints();
  all.unshift(c);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function updateComplaint(id: string, updates: Partial<FiledComplaint>) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function removeComplaint(id: string) {
  const all = getComplaints().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function addNotificationToComplaint(complaintId: string, event: Omit<NotificationEvent, "id">) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    const notif: NotificationEvent = {
      ...event,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    all[idx].notifications = [notif, ...(all[idx].notifications || [])];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

export function getUnreadNotificationCount(): number {
  return getComplaints().reduce((count, c) => {
    return count + (c.notifications || []).filter((n) => !n.read).length;
  }, 0);
}

export function markNotificationsRead(complaintId: string) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    all[idx].notifications = (all[idx].notifications || []).map((n) => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

/**
 * Simulate backend status progression.
 * In a real system, this would be triggered by the backend.
 * For the demo, we simulate it when a complaint is filed.
 */
export function simulateStatusProgression(complaintId: string) {
  const statusFlow: Array<{ status: FiledComplaint["status"]; delay: number; message: string }> = [
    { status: "processing", delay: 3000, message: "AI is analyzing your complaint..." },
    { status: "acknowledged", delay: 15000, message: "Complaint acknowledged by the system" },
    { status: "in_progress", delay: 45000, message: "Forwarded to department for inspection" },
  ];

  for (const step of statusFlow) {
    setTimeout(() => {
      const all = getComplaints();
      const idx = all.findIndex((c) => c.id === complaintId);
      if (idx < 0) return;
      const c = all[idx];
      // Don't regress status
      if (c.status === "resolved" || c.status === "confirmed_closed") return;
      const statusOrder = ["submitted", "processing", "acknowledged", "in_progress", "resolved", "confirmed_closed"];
      if (statusOrder.indexOf(step.status) > statusOrder.indexOf(c.status)) {
        all[idx].status = step.status;
        all[idx].notifications = [
          {
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: "status_change" as const,
            message: step.message,
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...(all[idx].notifications || []),
        ];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
    }, step.delay);
  }
}

/**
 * Mark a complaint as resolved by authorities.
 * Triggers a notification to the user.
 */
export function markResolved(complaintId: string, notes?: string) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    all[idx].status = "resolved";
    all[idx].resolved_at = new Date().toISOString();
    all[idx].resolution_notes = notes;
    all[idx].notifications = [
      {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "resolved" as const,
        message: "Your complaint has been resolved! Please confirm the issue is fixed.",
        timestamp: new Date().toISOString(),
        read: false,
      },
      ...(all[idx].notifications || []),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

/**
 * User confirms the issue is rectified.
 * Removes the complaint from the active dashboard.
 */
export function confirmResolution(complaintId: string) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    all[idx].status = "confirmed_closed";
    all[idx].confirmed_at = new Date().toISOString();
    all[idx].notifications = [
      {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: "status_change" as const,
        message: "Thank you! Complaint confirmed as resolved and removed from active tracking.",
        timestamp: new Date().toISOString(),
        read: true,
      },
      ...(all[idx].notifications || []),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

/**
 * Get active complaints (not confirmed closed).
 */
export function getActiveComplaints(): FiledComplaint[] {
  return getComplaints().filter((c) => c.status !== "confirmed_closed");
}

/**
 * Get closed complaints (confirmed closed).
 */
export function getClosedComplaints(): FiledComplaint[] {
  return getComplaints().filter((c) => c.status === "confirmed_closed");
}
