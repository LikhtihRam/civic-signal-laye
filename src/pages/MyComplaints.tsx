import { useState, useEffect } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  MapPin,
  Tag,
  AlertCircle,
  CheckCircle,
  FileText,
  Search,
  Trash2,
} from "lucide-react";
import { CATEGORY_LABELS, SEVERITY_COLORS, formatDate, formatDateTime } from "@/lib/constants";

interface FiledComplaint {
  id: string;
  raw_text: string;
  timestamp: string;
  ward: string;
  category: string;
  severity: string;
  lat: number | null;
  long: number | null;
  status: "submitted";
}

function getComplaints(): FiledComplaint[] {
  return JSON.parse(localStorage.getItem("civicsentinel_complaints") || "[]");
}

function removeComplaint(id: string) {
  const all = getComplaints().filter((c) => c.id !== id);
  localStorage.setItem("civicsentinel_complaints", JSON.stringify(all));
}

export default function MyComplaints() {
  const [complaints, setComplaints] = useState<FiledComplaint[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setComplaints(getComplaints());
  }, []);

  const handleDelete = (id: string) => {
    removeComplaint(id);
    setComplaints(getComplaints());
    if (expanded === id) setExpanded(null);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            to="/"
            className="p-2 rounded-xl hover:bg-white/50 transition-all text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-foreground">CivicSentinel</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Complaints</h1>
            <p className="text-muted-foreground">
              Track the status of complaints you have filed with CivicSentinel.
            </p>
          </div>
          <Link
            to="/file-complaint"
            className="shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
          >
            + New Complaint
          </Link>
        </motion.div>

        {complaints.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-16 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-blue-500/50" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              No complaints filed yet
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              When you file a complaint, it will appear here with tracking
              information as it's processed by the civic intelligence engine.
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
            {/* Summary bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-4 flex items-center gap-6 text-xs text-muted-foreground"
            >
              <span>
                <strong className="text-foreground font-semibold">{complaints.length}</strong>{" "}
                complaint{complaints.length !== 1 ? "s" : ""} filed
              </span>
              <span className="w-px h-3 bg-border" />
              <span>
                <strong className="text-foreground font-semibold">
                  {complaints.filter((c) => c.status === "submitted").length}
                </strong>{" "}
                submitted
              </span>
            </motion.div>

            {/* Complaint cards */}
            {complaints.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="w-full p-5 text-left hover:bg-white/40 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 mt-0.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium border"
                          style={{
                            color: SEVERITY_COLORS[c.severity] || "#6b7280",
                            borderColor: `${SEVERITY_COLORS[c.severity] || "#6b7280"}40`,
                            backgroundColor: `${SEVERITY_COLORS[c.severity] || "#6b7280"}10`,
                          }}
                        >
                          {c.severity}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {CATEGORY_LABELS[c.category] || c.category}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/20">
                          Submitted
                        </span>
                      </div>
                      <p
                        className={`text-sm text-foreground leading-relaxed ${
                          expanded !== c.id ? "line-clamp-2" : ""
                        }`}
                      >
                        {c.raw_text}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.ward}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(c.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {expanded === c.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-5 pb-5 border-t border-white/20"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs">
                      <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                        <span className="text-muted-foreground">Ward</span>
                        <p className="font-medium text-foreground mt-0.5">{c.ward}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                        <span className="text-muted-foreground">Category</span>
                        <p className="font-medium text-foreground mt-0.5">
                          {CATEGORY_LABELS[c.category] || c.category}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                        <span className="text-muted-foreground">Filed</span>
                        <p className="font-medium text-foreground mt-0.5">
                          {formatDateTime(c.timestamp)}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                        <span className="text-muted-foreground">Complaint ID</span>
                        <p className="font-mono text-foreground mt-0.5">{c.id}</p>
                      </div>
                    </div>

                    {/* What happens next */}
                    <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <h4 className="text-xs font-semibold text-blue-600 mb-2">
                        What happens next?
                      </h4>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-blue-600">
                            1
                          </span>
                          <span>
                            AI extracts structured signals (category, severity,
                            urgency) from your description
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-blue-600">
                            2
                          </span>
                          <span>
                            Your complaint is correlated with similar reports
                            in your area to form clusters
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-blue-600">
                            3
                          </span>
                          <span>
                            Root cause hypotheses and risk scores are generated
                            for the cluster
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-blue-600">
                            4
                          </span>
                          <span>
                            Recommended actions are surfaced to the responsible
                            municipal department
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleDelete(c.id);
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-500/70 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/5"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
