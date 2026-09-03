import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  MapPin,
  Clock,
  Shield,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { api, ClusterDetail as ClusterDetailType, Complaint } from "@/lib/api";
import {
  RISK_COLORS,
  CATEGORY_ICONS,
  formatCategory,
  formatDate,
  formatDateTime,
  SEVERITY_COLORS,
  riskScoreToColor,
} from "@/lib/constants";

function RiskBar({ name, score, weight, detail }: {
  name: string; score: number; weight: number; detail: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium capitalize">
          {name.replace(/_/g, " ")}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">w={weight}</span>
          <span className="font-bold text-foreground">{score.toFixed(1)}</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-black/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="h-full rounded-full"
          style={{ backgroundColor: riskScoreToColor(score) }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ComplaintRow({ complaint, index }: { complaint: Complaint; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/40 transition-all"
      >
        <span className="text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg px-2 py-1 shrink-0 mt-0.5">
          #{index + 1}
        </span>
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
            <span className="text-xs text-muted-foreground">
              {formatCategory(complaint.category || complaint.category_raw || "unknown")}
            </span>
            {complaint.urgency_flag ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/10 text-red-600 border border-red-500/20">
                URGENT
              </span>
            ) : null}
          </div>
          <p className={`text-sm text-foreground leading-relaxed ${open ? "" : "line-clamp-2"}`}>
            {complaint.raw_text}
          </p>
        </div>
        <div className="shrink-0 text-muted-foreground mt-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="px-4 pb-4 border-t border-white/20"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
            <div>
              <span className="text-muted-foreground">Ward</span>
              <p className="font-medium text-foreground">{complaint.ward}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date</span>
              <p className="font-medium text-foreground">{formatDateTime(complaint.timestamp)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sentiment</span>
              <p className="font-medium text-foreground capitalize">{complaint.sentiment}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Affected Pop.</span>
              <p className="font-medium text-foreground">~{complaint.affected_population_estimate}</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function ClusterDetail() {
  const { id } = useParams<{ id: string }>();
  const [cluster, setCluster] = useState<ClusterDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string>("");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [showComplaints, setShowComplaints] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.clusterDetail(id)
      .then((c) => {
        setCluster(c);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  const handleFeedback = async () => {
    if (!id || !feedbackStatus) return;
    try {
      await api.submitFeedback(id, {
        status: feedbackStatus,
        outcome_notes: feedbackNotes,
      });
      setFeedbackSubmitted(true);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-2xl px-8 py-6 text-muted-foreground animate-pulse">
          Loading cluster details...
        </div>
      </div>
    );
  }

  if (error || !cluster) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-strong rounded-2xl max-w-md text-center p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Cluster Not Found</h2>
          <p className="text-sm text-muted-foreground">{error || "Cluster data unavailable"}</p>
          <Link to="/clusters" className="inline-flex items-center gap-1 text-sm text-blue-600 mt-4 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to clusters
          </Link>
        </div>
      </div>
    );
  }

  const risk = cluster.risk_score;
  const breakdown = risk?.breakdown;
  const complaints = cluster.member_complaints || [];
  const rootCauses = cluster.root_causes || [];
  const recommendation = cluster.recommendation;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            to="/clusters"
            className="p-2 rounded-xl hover:bg-white/50 transition-all text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{CATEGORY_ICONS[cluster.category_family] || "📋"}</span>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {formatCategory(cluster.category_family)}
              </h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cluster.ward}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(cluster.time_window_start)} – {formatDate(cluster.time_window_end)}</span>
              </div>
            </div>
          </div>
          {risk && (
            <div className="ml-auto text-right">
              <div className="text-3xl font-black" style={{ color: riskScoreToColor(risk.total_score) }}>
                {risk.total_score.toFixed(1)}
              </div>
              <div
                className="text-xs font-bold px-2 py-0.5 rounded-lg border"
                style={{
                  color: RISK_COLORS[risk.risk_bucket] || "#6b7280",
                  borderColor: `${RISK_COLORS[risk.risk_bucket] || "#6b7280"}30`,
                  backgroundColor: `${RISK_COLORS[risk.risk_bucket] || "#6b7280"}12`,
                }}
              >
                {risk.risk_bucket}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Key Insight Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-2xl p-6 border-l-4"
          style={{ borderLeftColor: riskScoreToColor(risk?.total_score || 0) }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-foreground">Cluster Analysis</h2>
          </div>
          <p className="text-foreground text-lg font-medium">
            {complaints.length} complaints from {cluster.ward} are correlated as{" "}
            <span className="text-blue-600">{formatCategory(cluster.category_family).toLowerCase()}</span>{" "}
            issues — potentially <strong>one underlying problem</strong>.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {rootCauses.length > 0
              ? `Top hypothesis: ${rootCauses[0].hypothesis_text.substring(0, 120)}...`
              : "Root cause analysis pending."}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Root Cause Hypotheses */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-foreground">Root Cause Hypotheses</h2>
              </div>
              <div className="space-y-4">
                {rootCauses.map((rc, i) => (
                  <div key={rc.id} className="p-4 rounded-xl bg-white/40 border border-white/30">
                    <div className="flex items-start gap-3">
                      <span className="text-xs font-bold bg-blue-500/10 text-blue-600 rounded-lg px-2 py-1 shrink-0">
                        #{rc.rank}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-foreground font-medium leading-relaxed">
                          {rc.hypothesis_text}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Confidence:</span>
                          <div className="h-1.5 w-24 rounded-full bg-black/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${rc.confidence_level * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground">
                            {(rc.confidence_level * 100).toFixed(0)}%
                          </span>
                        </div>
                        {rc.supporting_evidence && rc.supporting_evidence.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-xs text-muted-foreground font-medium">Supporting Evidence:</span>
                            {rc.supporting_evidence.map((ev, j) => (
                              <p key={j} className="text-xs text-muted-foreground pl-3 border-l-2 border-blue-200 italic">
                                "{ev}"
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recommendation */}
            {recommendation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h2 className="text-base font-bold text-foreground">Recommended Action</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-white/40 border border-white/30">
                    <span className="text-xs text-muted-foreground">Department</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {recommendation.department}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/40 border border-white/30">
                    <span className="text-xs text-muted-foreground">Priority</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {recommendation.priority}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/40 border border-white/30">
                    <span className="text-xs text-muted-foreground">Response Window</span>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {recommendation.response_window}
                    </p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/40 border border-white/30">
                  <p className="text-sm text-foreground leading-relaxed">
                    {recommendation.suggested_action}
                  </p>
                </div>
                {recommendation.draft_advisory_text && (
                  <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <span className="text-xs font-medium text-blue-600 mb-1 block">Draft Public Advisory</span>
                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                      {recommendation.draft_advisory_text}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* Source Complaints */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-6"
            >
              <button
                onClick={() => setShowComplaints(!showComplaints)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <h2 className="text-base font-bold text-foreground">
                    Source Complaints ({complaints.length})
                  </h2>
                </div>
                {showComplaints ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              {showComplaints && (
                <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {complaints.map((c, i) => (
                    <ComplaintRow key={c.id} complaint={c} index={i} />
                  ))}
                </div>
              )}
              {!showComplaints && (
                <p className="text-xs text-muted-foreground mt-2">
                  Click to expand {complaints.length} individual complaints in this cluster
                </p>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Risk Score Breakdown */}
            {risk && breakdown && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass rounded-2xl p-5"
              >
                <h3 className="text-sm font-semibold text-foreground mb-4">Risk Score Breakdown</h3>
                <div className="space-y-4">
                  {Object.entries(breakdown).map(([key, val]) => (
                    <RiskBar
                      key={key}
                      name={key}
                      score={val.score}
                      weight={val.weight}
                      detail={val.detail}
                    />
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Total Score</span>
                    <span className="text-2xl font-black" style={{ color: riskScoreToColor(risk.total_score) }}>
                      {risk.total_score.toFixed(1)}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Severity Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass rounded-2xl p-5"
            >
              <h3 className="text-sm font-semibold text-foreground mb-3">Severity Distribution</h3>
              <div className="space-y-2">
                {["Critical", "High", "Medium", "Low"].map((sev) => {
                  const count = complaints.filter((c) => c.severity === sev).length;
                  const pct = complaints.length > 0 ? (count / complaints.length) * 100 : 0;
                  return (
                    <div key={sev}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: SEVERITY_COLORS[sev] }} className="font-medium">{sev}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(pct, 1)}%`,
                            backgroundColor: SEVERITY_COLORS[sev],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Authority Feedback */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="glass rounded-2xl p-5"
            >
              <h3 className="text-sm font-semibold text-foreground mb-3">Authority Feedback</h3>
              {feedbackSubmitted ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-foreground font-medium">Feedback recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {["verified", "false_positive", "resolved"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setFeedbackStatus(s)}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          feedbackStatus === s
                            ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                            : "text-muted-foreground border-white/20 hover:bg-white/40"
                        }`}
                      >
                        {s === "false_positive" ? "False +" : s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Notes (optional)..."
                    className="w-full glass rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground border-0 outline-none resize-none"
                    rows={2}
                  />
                  <button
                    onClick={handleFeedback}
                    disabled={!feedbackStatus}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500/10 text-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Feedback
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
