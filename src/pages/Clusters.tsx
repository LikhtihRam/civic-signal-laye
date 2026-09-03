import { useState, useEffect } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  ChevronDown,
  MapPin,
  Clock,
} from "lucide-react";
import { api, Cluster } from "@/lib/api";
import {
  RISK_COLORS,
  CATEGORY_ICONS,
  formatCategory,
  formatDate,
  riskScoreToColor,
} from "@/lib/constants";

type SortKey = "risk" | "count" | "date";

export default function Clusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wardFilter, setWardFilter] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("risk");
  const [wards, setWards] = useState<{ ward: string; complaint_count: number }[]>([]);

  useEffect(() => {
    Promise.all([
      api.clusters({ limit: 100 }),
      api.wards(),
    ])
      .then(([cl, w]) => {
        setClusters(cl.clusters);
        setWards(w.wards);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const filtered = clusters
    .filter((c) => !wardFilter || c.ward === wardFilter)
    .filter((c) => !riskFilter || c.risk_bucket === riskFilter)
    .sort((a, b) => {
      if (sortBy === "risk") return (b.total_score || 0) - (a.total_score || 0);
      if (sortBy === "count") return b.member_count - a.member_count;
      return new Date(b.time_window_end).getTime() - new Date(a.time_window_end).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-2xl px-8 py-6 text-muted-foreground animate-pulse">
          Loading clusters...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-strong rounded-2xl max-w-md text-center p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Connection Error</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-3">
            Start the backend: <code className="bg-muted rounded px-1.5 py-0.5">cd backend && python3 app.py</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-strong sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-foreground">CivicSentinel</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to="/dashboard"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/50 transition-all"
              >
                Dashboard
              </Link>
              <Link
                to="/clusters"
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-600"
              >
                Clusters
              </Link>
              <Link
                to="/file-complaint"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/50 transition-all"
              >
                File Complaint
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 mb-6"
        >
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex items-center gap-2 text-sm text-foreground font-medium">
              <Filter className="w-4 h-4" />
              Filters
            </div>

            <div className="flex flex-wrap gap-3 flex-1">
              {/* Ward filter */}
              <div className="relative">
                <select
                  value={wardFilter}
                  onChange={(e) => setWardFilter(e.target.value)}
                  className="appearance-none glass rounded-xl px-4 py-2 pr-8 text-sm text-foreground bg-transparent border-0 outline-none cursor-pointer"
                >
                  <option value="">All Wards</option>
                  {wards.map((w) => (
                    <option key={w.ward} value={w.ward}>
                      {w.ward} ({w.complaint_count})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>

              {/* Risk filter */}
              <div className="relative">
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="appearance-none glass rounded-xl px-4 py-2 pr-8 text-sm text-foreground bg-transparent border-0 outline-none cursor-pointer"
                >
                  <option value="">All Risk Levels</option>
                  <option value="Critical">Critical</option>
                  <option value="High-Risk">High-Risk</option>
                  <option value="Elevated">Elevated</option>
                  <option value="Watch">Watch</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="flex gap-1">
                {([
                  { key: "risk" as SortKey, label: "Risk" },
                  { key: "count" as SortKey, label: "Count" },
                  { key: "date" as SortKey, label: "Date" },
                ]).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sortBy === s.key
                        ? "bg-blue-500/15 text-blue-600"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <span className="text-xs text-muted-foreground">
              {filtered.length} clusters
            </span>
          </div>
        </motion.div>

        {/* Cluster Grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((cluster, i) => (
            <motion.div
              key={cluster.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link
                to={`/clusters/${cluster.id}`}
                className="glass rounded-2xl p-5 block hover:bg-white/70 transition-all duration-200 group h-full"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{CATEGORY_ICONS[cluster.category_family] || "📋"}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-blue-600 transition-colors">
                        {formatCategory(cluster.category_family)}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {cluster.ward}
                      </div>
                    </div>
                  </div>
                  <div
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border"
                    style={{
                      color: riskScoreToColor(cluster.total_score || 0),
                      backgroundColor: `${riskScoreToColor(cluster.total_score || 0)}15`,
                      borderColor: `${riskScoreToColor(cluster.total_score || 0)}30`,
                    }}
                  >
                    {cluster.risk_bucket || "N/A"}
                  </div>
                </div>

                {/* Score bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Risk Score</span>
                    <span className="font-bold" style={{ color: riskScoreToColor(cluster.total_score || 0) }}>
                      {cluster.total_score?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(cluster.total_score || 0, 100)}%`,
                        backgroundColor: riskScoreToColor(cluster.total_score || 0),
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-foreground">{cluster.member_count}</span> complaints
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(cluster.time_window_end)}
                  </div>
                </div>

                {/* Arrow */}
                <div className="mt-3 flex items-center gap-1 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  View Details <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No clusters match the current filters.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
