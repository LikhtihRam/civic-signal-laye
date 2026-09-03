import { useState, useEffect } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle,
  FileText,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Trash2,
  Settings,
  AlertCircle,
  Loader2,
  Shield,
  RotateCcw,
} from "lucide-react";
import { CATEGORY_LABELS, SEVERITY_COLORS, formatDateTime } from "@/lib/constants";
import { getGeminiKey } from "@/lib/gemini";
import {
  getActiveComplaints,
  getClosedComplaints,
  updateComplaint,
  removeComplaint,
  markNotificationsRead,
  markResolved,
  confirmResolution,
  type FiledComplaint,
} from "@/lib/complaints";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  submitted: { label: "Submitted", color: "text-blue-600", bgColor: "bg-blue-500/10 border-blue-500/20", icon: <FileText className="w-3 h-3" /> },
  processing: { label: "Processing", color: "text-violet-600", bgColor: "bg-violet-500/10 border-violet-500/20", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  acknowledged: { label: "Acknowledged", color: "text-cyan-600", bgColor: "bg-cyan-500/10 border-cyan-500/20", icon: <CheckCircle className="w-3 h-3" /> },
  in_progress: { label: "In Progress", color: "text-amber-600", bgColor: "bg-amber-500/10 border-amber-500/20", icon: <RotateCcw className="w-3 h-3" /> },
  resolved: { label: "Resolved — Awaiting Confirmation", color: "text-green-600", bgColor: "bg-green-500/10 border-green-500/20", icon: <CheckCircle className="w-3 h-3" /> },
  confirmed_closed: { label: "Closed", color: "text-gray-500", bgColor: "bg-gray-500/10 border-gray-500/20", icon: <CheckCircle className="w-3 h-3" /> },
};

function ComplaintCard({
  complaint,
  onDelete,
  onConfirm,
  onSimResolve,
}: {
  complaint: FiledComplaint;
  onDelete: (id: string) => void;
  onConfirm: (id: string) => void;
  onSimResolve: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const unread = (complaint.notifications || []).filter((n) => !n.read).length;
  const sc = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.submitted;

  const etaRemaining = complaint.estimated_date
    ? Math.max(0, Math.ceil((new Date(complaint.estimated_date).getTime() - Date.now()) / 86400000))
    : null;

  const etaProgress = complaint.estimated_days
    ? Math.min(100, ((complaint.estimated_days - (etaRemaining ?? 0)) / complaint.estimated_days) * 100)
    : 0;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (unread > 0) markNotificationsRead(complaint.id);
        }}
        className="w-full p-5 text-left hover:bg-white/40 transition-all"
      >
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sc.bgColor} border`}>
              {sc.icon}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium border"
                style={{
                  color: SEVERITY_COLORS[complaint.severity] || "#6b7280",
                  borderColor: `${SEVERITY_COLORS[complaint.severity] || "#6b7280"}40`,
                  backgroundColor: `${SEVERITY_COLORS[complaint.severity] || "#6b7280"}10`,
                }}
              >
                {complaint.severity}
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                {CATEGORY_LABELS[complaint.category] || complaint.category}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${sc.bgColor} ${sc.color}`}>
                {sc.label}
              </span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unread}
                </span>
              )}
            </div>
            <p className={`text-sm text-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
              {complaint.raw_text}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{complaint.ward}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(complaint.timestamp)}</span>
            </div>
          </div>

          {/* ETA badge on collapsed */}
          {!expanded && complaint.estimated_days && complaint.status !== "confirmed_closed" && (
            <div className="shrink-0 text-right">
              <div className="text-lg font-black text-amber-600">{etaRemaining ?? complaint.estimated_days}</div>
              <div className="text-[10px] text-muted-foreground">days left</div>
            </div>
          )}

          <div className="shrink-0 text-muted-foreground mt-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/20">
              {/* ETA Progress Bar */}
              {complaint.estimated_days && complaint.status !== "confirmed_closed" && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-bold text-foreground">Resolution Timeline</span>
                    </div>
                    <span className="text-sm font-bold text-amber-600">
                      {etaRemaining !== null ? `${etaRemaining} days remaining` : `~${complaint.estimated_days} days`}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-black/5 overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(etaProgress, 3)}%` }}
                      transition={{ duration: 1 }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Filed {formatDateTime(complaint.timestamp)}</span>
                    {complaint.estimated_date && (
                      <span>Expected by {new Date(complaint.estimated_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    )}
                  </div>
                  {complaint.eta_reasoning && (
                    <p className="text-[10px] text-muted-foreground mt-2 italic">{complaint.eta_reasoning}</p>
                  )}
                </div>
              )}

              {/* Root cause + department */}
              {(complaint.root_cause || complaint.department) && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {complaint.root_cause && (
                    <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Root Cause</span>
                      <p className="text-xs text-foreground font-medium mt-1 leading-relaxed">{complaint.root_cause}</p>
                    </div>
                  )}
                  {complaint.department && (
                    <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Department</span>
                      <p className="text-xs text-foreground font-medium mt-1">{complaint.department}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notifications Timeline */}
              {complaint.notifications && complaint.notifications.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <Bell className="w-3 h-3" />
                    Status Updates
                  </h4>
                  <div className="space-y-1.5">
                    {complaint.notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
                          n.read ? "text-muted-foreground" : "text-foreground bg-blue-500/5"
                        }`}
                      >
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1" />}
                        <span className="flex-1">{n.message}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatDateTime(n.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {/* Simulate resolution (for demo) */}
                {complaint.status === "in_progress" && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onSimResolve(complaint.id);
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Mark as Resolved (Demo)
                  </button>
                )}

                {/* Confirm resolution */}
                {complaint.status === "resolved" && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onConfirm(complaint.id);
                    }}
                    className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors px-4 py-2 rounded-lg bg-green-500/15 border border-green-500/30 shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    ✓ Yes, the issue is fixed — Close complaint
                  </button>
                )}

                {complaint.status === "confirmed_closed" && (
                  <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Confirmed closed {complaint.confirmed_at ? `on ${formatDateTime(complaint.confirmed_at)}` : ""}
                  </span>
                )}

                <div className="ml-auto">
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onDelete(complaint.id);
                    }}
                    className="flex items-center gap-1 text-xs text-red-500/60 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MyComplaints() {
  const [activeComplaints, setActiveComplaints] = useState<FiledComplaint[]>([]);
  const [closedComplaints, setClosedComplaints] = useState<FiledComplaint[]>([]);
  const [showClosed, setShowClosed] = useState(false);
  const hasGemini = !!getGeminiKey();

  const reload = () => {
    setActiveComplaints(getActiveComplaints());
    setClosedComplaints(getClosedComplaints());
  };

  useEffect(() => {
    reload();
    // Poll for status changes every 5 seconds
    const interval = setInterval(reload, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalUnread = activeComplaints.reduce(
    (sum, c) => sum + (c.notifications || []).filter((n) => !n.read).length,
    0
  );

  const resolvedAwaiting = activeComplaints.filter((c) => c.status === "resolved").length;

  return (
    <div className="min-h-screen">
      <header className="glass-strong sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/" className="p-2 rounded-xl hover:bg-white/50 transition-all text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-foreground">CivicSentinel</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {!hasGemini && (
              <Link to="/settings" className="flex items-center gap-1 text-xs font-medium text-amber-600">
                <Settings className="w-3 h-3" /> AI Key
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Complaints</h1>
            <p className="text-muted-foreground">
              Track your filed complaints, view resolution timelines, and confirm fixes.
            </p>
          </div>
          <Link
            to="/file-complaint"
            className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
          >
            + New Complaint
          </Link>
        </motion.div>

        {/* Notification Banner */}
        {resolvedAwaiting > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-700">
                {resolvedAwaiting} complaint{resolvedAwaiting > 1 ? "s" : ""} resolved — awaiting your confirmation
              </p>
              <p className="text-xs text-green-600/70">
                Please check if the issue is fixed and confirm to close the complaint.
              </p>
            </div>
          </motion.div>
        )}

        {totalUnread > 0 && resolvedAwaiting === 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-3"
          >
            <Bell className="w-5 h-5 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-700">
              You have <strong>{totalUnread}</strong> new notification{totalUnread > 1 ? "s" : ""}
            </p>
          </motion.div>
        )}

        {activeComplaints.length === 0 && closedComplaints.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-blue-500/50" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">No complaints filed yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              File your first complaint and track its resolution timeline with AI-powered analysis.
            </p>
            <Link
              to="/file-complaint"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-3.5 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all"
            >
              <AlertCircle className="w-4 h-4" />
              File Your First Complaint
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
            >
              <span>
                <strong className="text-foreground">{activeComplaints.length}</strong> active
              </span>
              <span className="w-px h-3 bg-border" />
              <span>
                <strong className="text-green-600">{resolvedAwaiting}</strong> awaiting confirmation
              </span>
              {closedComplaints.length > 0 && (
                <>
                  <span className="w-px h-3 bg-border" />
                  <button
                    onClick={() => setShowClosed(!showClosed)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {showClosed ? "Hide" : "Show"} {closedComplaints.length} closed
                  </button>
                </>
              )}
            </motion.div>

            {/* Active complaints */}
            {activeComplaints.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <ComplaintCard
                  complaint={c}
                  onDelete={(id) => { removeComplaint(id); reload(); }}
                  onConfirm={(id) => { confirmResolution(id); reload(); }}
                  onSimResolve={(id) => { markResolved(id); reload(); }}
                />
              </motion.div>
            ))}

            {/* Closed complaints */}
            {showClosed && closedComplaints.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Closed Complaints
                </h3>
                {closedComplaints.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="mb-3"
                  >
                    <ComplaintCard
                      complaint={c}
                      onDelete={(id) => { removeComplaint(id); reload(); }}
                      onConfirm={() => {}}
                      onSimResolve={() => {}}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
