/**
 * Complaint storage with extended lifecycle:
 * - submitted → processing → acknowledged → in_progress → resolved → confirmed_closed
 * - ~40% of users confirm → clean close
 * - ~60% don't confirm → persistent nudge, never auto-close, stays visible
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
  // AI-enriched
  summary?: string;
  sentiment?: string;
  urgency_flag?: boolean;
  estimated_days?: number;
  estimated_date?: string;
  root_cause?: string;
  department?: string;
  eta_reasoning?: string;
  affected_population_estimate?: number;
  // Resolution
  resolved_at?: string;
  confirmed_at?: string;
  resolution_notes?: string;
  // Reminder tracking
  reminder_count?: number;
  last_reminder_at?: string;
  snoozed_until?: string;
  // Notifications
  notifications: NotificationEvent[];
}

export interface NotificationEvent {
  id: string;
  type: "status_change" | "resolved" | "reminder" | "eta_updated";
  message: string;
  timestamp: string;
  read: boolean;
}

const STORAGE_KEY = "civicsentinel_complaints";

export function getComplaints(): FiledComplaint[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function persist(all: FiledComplaint[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function saveComplaint(c: FiledComplaint) {
  const all = getComplaints();
  all.unshift(c);
  persist(all);
}

export function updateComplaint(id: string, updates: Partial<FiledComplaint>) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    persist(all);
  }
}

export function removeComplaint(id: string) {
  persist(getComplaints().filter((c) => c.id !== id));
}

export function addNotification(complaintId: string, event: Omit<NotificationEvent, "id">) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    all[idx].notifications = [
      { ...event, id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      ...(all[idx].notifications || []),
    ];
    persist(all);
  }
}

export function markNotificationsRead(complaintId: string) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    all[idx].notifications = (all[idx].notifications || []).map((n) => ({ ...n, read: true }));
    persist(all);
  }
}

/**
 * Simulate backend status progression.
 */
export function simulateStatusProgression(complaintId: string) {
  const steps: Array<{ status: FiledComplaint["status"]; delay: number; message: string }> = [
    { status: "processing", delay: 3000, message: "AI is analyzing your complaint..." },
    { status: "acknowledged", delay: 15000, message: "Complaint acknowledged by the system" },
    { status: "in_progress", delay: 45000, message: "Forwarded to department for inspection" },
  ];

  for (const step of steps) {
    setTimeout(() => {
      const all = getComplaints();
      const idx = all.findIndex((c) => c.id === complaintId);
      if (idx < 0) return;
      const c = all[idx];
      if (c.status === "resolved" || c.status === "confirmed_closed") return;
      const order = ["submitted", "processing", "acknowledged", "in_progress", "resolved", "confirmed_closed"];
      if (order.indexOf(step.status) > order.indexOf(c.status)) {
        all[idx].status = step.status;
        all[idx].notifications = [
          { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "status_change", message: step.message, timestamp: new Date().toISOString(), read: false },
          ...(all[idx].notifications || []),
        ];
        persist(all);
      }
    }, step.delay);
  }
}

/**
 * Mark resolved → triggers resolution notification to user.
 */
export function markResolved(complaintId: string, notes?: string) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    all[idx].status = "resolved";
    all[idx].resolved_at = new Date().toISOString();
    all[idx].resolution_notes = notes;
    all[idx].reminder_count = 0;
    all[idx].notifications = [
      { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "resolved", message: "Your complaint has been resolved! Please confirm the issue is fixed.", timestamp: new Date().toISOString(), read: false },
      ...(all[idx].notifications || []),
    ];
    persist(all);
  }
}

/**
 * User confirms → complaint closed and removed from active view.
 */
export function confirmResolution(complaintId: string) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    all[idx].status = "confirmed_closed";
    all[idx].confirmed_at = new Date().toISOString();
    all[idx].notifications = [
      { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "status_change", message: "Complaint confirmed as resolved. Thank you!", timestamp: new Date().toISOString(), read: true },
      ...(all[idx].notifications || []),
    ];
    persist(all);
  }
}

/**
 * Snooze reminders for a resolved complaint.
 */
export function snoozeReminder(complaintId: string, hours: number = 48) {
  const all = getComplaints();
  const idx = all.findIndex((c) => c.id === complaintId);
  if (idx >= 0) {
    const until = new Date();
    until.setHours(until.getHours() + hours);
    all[idx].snoozed_until = until.toISOString();
    all[idx].last_reminder_at = new Date().toISOString();
    persist(all);
  }
}

/**
 * Send a reminder nudge for unresolved "resolved" complaints.
 * Called periodically — only sends if not snoozed.
 */
export function sendReminders(): string[] {
  const notified: string[] = [];
  const all = getComplaints();
  const now = Date.now();

  for (let i = 0; i < all.length; i++) {
    const c = all[i];
    if (c.status !== "resolved") continue;

    // Skip if snoozed
    if (c.snoozed_until && new Date(c.snoozed_until).getTime() > now) continue;

    const resolvedTime = c.resolved_at ? new Date(c.resolved_at).getTime() : now;
    const hoursSinceResolved = (now - resolvedTime) / 3600000;
    const reminderCount = c.reminder_count || 0;

    // Only remind if enough time has passed since last reminder
    // First reminder: 24h after resolution, then every 48h
    const minInterval = reminderCount === 0 ? 24 : 48;
    if (hoursSinceResolved < minInterval) continue;

    // Escalating message tone
    const messages = [
      "Your complaint has been resolved. Could you confirm if the issue is fixed?",
      "Reminder: Your complaint was marked resolved. Please confirm or the issue will remain open.",
      "We noticed you haven't confirmed the resolution yet. Is everything okay? Please confirm when you can.",
      "Your complaint is still open because the resolution hasn't been confirmed. Take a moment to verify the fix?",
    ];

    const msgIdx = Math.min(reminderCount, messages.length - 1);

    all[i].reminder_count = reminderCount + 1;
    all[i].last_reminder_at = new Date().toISOString();
    all[i].notifications = [
      { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "reminder", message: messages[msgIdx], timestamp: new Date().toISOString(), read: false },
      ...(all[i].notifications || []),
    ];
    notified.push(c.id);
  }

  if (notified.length > 0) persist(all);
  return notified;
}

export function getActiveComplaints(): FiledComplaint[] {
  return getComplaints().filter((c) => c.status !== "confirmed_closed");
}

export function getClosedComplaints(): FiledComplaint[] {
  return getComplaints().filter((c) => c.status === "confirmed_closed");
}

export function getUnreadCount(): number {
  return getComplaints().reduce((sum, c) => sum + (c.notifications || []).filter((n) => !n.read).length, 0);
}

export function getResolvedAwaitingCount(): number {
  return getComplaints().filter((c) => c.status === "resolved").length;
}
