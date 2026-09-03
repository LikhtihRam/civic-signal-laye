import { useState, useEffect } from "react";
import { Link } from "react-router";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  MapPin,
  TrendingUp,
  Shield,
  Activity,
} from "lucide-react";
import { api, MapData, Stats } from "@/lib/api";
import {
  RISK_COLORS,
  CATEGORY_ICONS,
  formatCategory,
  riskScoreToColor,
} from "@/lib/constants";

function FitBounds({ clusters }: { clusters: MapData[] }) {
  const map = useMap();
  useEffect(() => {
    if (clusters.length === 0) return;
    const lats = clusters.map((c) => c.centroid_lat);
    const lngs = clusters.map((c) => c.centroid_long);
    const bounds = [
      [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
      [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01],
    ] as [[number, number], [number, number]];
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [clusters, map]);
  return null;
}

export default function Dashboard() {
  const [mapData, setMapData] = useState<MapData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.mapData(), api.stats()])
      .then(([md, st]) => {
        setMapData(md.clusters);
        setStats(st);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-strong rounded-2xl px-8 py-6 text-muted-foreground animate-pulse">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-strong rounded-2xl max-w-md text-center p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Cannot connect to backend</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <p className="text-xs text-muted-foreground">
            Make sure the FastAPI server is running on port 8000.
            <br />
            Run: <code className="bg-muted rounded px-1.5 py-0.5">cd backend && python3 app.py</code>
          </p>
        </div>
      </div>
    );
  }

  const topClusters = [...mapData].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));

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
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-600"
              >
                Dashboard
              </Link>
              <Link
                to="/clusters"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/50 transition-all"
              >
                Clusters
              </Link>
            </nav>
          </div>
          <Link
            to="/clusters"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View All Clusters <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Row */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
          >
            {[
              {
                label: "Total Complaints",
                value: stats.total_complaints,
                icon: <Activity className="w-4 h-4" />,
                color: "text-blue-600",
              },
              {
                label: "Active Clusters",
                value: stats.total_clusters,
                icon: <MapPin className="w-4 h-4" />,
                color: "text-cyan-600",
              },
              {
                label: "Urgent Complaints",
                value: stats.urgent_complaints,
                icon: <TrendingUp className="w-4 h-4" />,
                color: "text-amber-600",
              },
              {
                label: "Critical",
                value: stats.critical_complaints,
                icon: <Shield className="w-4 h-4" />,
                color: "text-red-600",
              },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl p-5">
                <div className={`flex items-center gap-2 ${s.color} mb-2`}>
                  {s.icon}
                  <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
                </div>
                <div className="text-3xl font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 glass rounded-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/20">
              <h2 className="text-base font-semibold text-foreground">Cluster Hotspot Map</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Circle size = complaint count · Color = risk level
              </p>
            </div>
            <div className="h-[500px]">
              <MapContainer
                center={[12.96, 77.65]}
                zoom={12}
                style={{ height: "100%", width: "100%", background: "#e8f0fe" }}
                zoomControl={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                {mapData.length > 0 && <FitBounds clusters={mapData} />}
                {mapData.map((cluster) => (
                  <CircleMarker
                    key={cluster.cluster_id}
                    center={[cluster.centroid_lat, cluster.centroid_long]}
                    radius={Math.max(8, Math.min(30, cluster.member_count * 0.6))}
                    pathOptions={{
                      color: riskScoreToColor(cluster.risk_score || 0),
                      fillColor: riskScoreToColor(cluster.risk_score || 0),
                      fillOpacity: 0.35,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[180px]">
                        <div className="font-semibold text-sm text-gray-900">
                          {formatCategory(cluster.category_family)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {cluster.ward}
                        </div>
                        <div className="text-xs mt-1">
                          <span className="font-medium">{cluster.member_count}</span> complaints ·{" "}
                          <span style={{ color: riskScoreToColor(cluster.risk_score || 0) }}>
                            {cluster.risk_bucket || "N/A"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Score: {cluster.risk_score?.toFixed(1) ?? "N/A"}
                        </div>
                        <Link
                          to={`/clusters/${cluster.cluster_id}`}
                          className="inline-block text-xs text-blue-600 mt-2 hover:underline"
                        >
                          View Details →
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </motion.div>

          {/* Risk Distribution + Top Clusters */}
          <div className="space-y-4">
            {/* Risk Distribution */}
            {stats && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-2xl p-5"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">Risk Distribution</h3>
                <div className="space-y-2.5">
                  {["Critical", "High-Risk", "Elevated", "Watch"].map((level) => {
                    const count = stats.risk_distribution[level] || 0;
                    const total = stats.total_clusters || 1;
                    const pct = (count / total) * 100;
                    return (
                      <div key={level}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: RISK_COLORS[level] }} className="font-medium">
                            {level}
                          </span>
                          <span className="text-muted-foreground">{count} clusters</span>
                        </div>
                        <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              backgroundColor: RISK_COLORS[level],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Top Risk Clusters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-5"
            >
              <h3 className="text-sm font-semibold text-foreground mb-3">Highest Risk Clusters</h3>
              <div className="space-y-2">
                {topClusters.slice(0, 5).map((c) => (
                  <Link
                    key={c.cluster_id}
                    to={`/clusters/${c.cluster_id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/50 transition-all group"
                  >
                    <span className="text-xl">{CATEGORY_ICONS[c.category_family] || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {formatCategory(c.category_family)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.ward}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-sm font-bold"
                        style={{ color: riskScoreToColor(c.risk_score || 0) }}
                      >
                        {c.risk_score?.toFixed(1) ?? "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.member_count} complaints
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
