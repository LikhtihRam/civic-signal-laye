import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  Shield,
  MapPin,
  BarChart3,
  AlertTriangle,
  ArrowRight,
  Eye,
  Zap,
  Layers,
} from "lucide-react";

const features = [
  {
    icon: <Layers className="w-6 h-6" />,
    title: "27 Complaints → 1 Problem",
    desc: "Correlate fragmented citizen complaints into single actionable clusters using geo-temporal-categorical analysis.",
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: "Explainable AI",
    desc: "Every score, hypothesis, and recommendation shows its reasoning with evidence from actual citizen complaints.",
  },
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "Hotspot Map",
    desc: "Visualize risk clusters on an interactive map with real-time ward-level heatmap overlays.",
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Early Warning",
    desc: "Detect emerging infrastructure problems before they escalate into large-scale failures.",
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Risk Scoring",
    desc: "Transparent, weighted scoring with full component breakdown — not a black-box number.",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Decision Support",
    desc: "Augment, don't replace. AI-generated recommendations with confidence levels for human authorities.",
  },
];

const stats = [
  { value: "250+", label: "Complaints Processed" },
  { value: "9", label: "Clusters Detected" },
  { value: "100%", label: "Explainable Scores" },
  { value: "< 1s", label: "Pipeline Run Time" },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              CivicSentinel
            </span>
          </div>
          <Link
            to="/dashboard"
            className="glass rounded-xl px-5 py-2.5 text-sm font-medium text-foreground hover:bg-white/70 transition-all duration-200"
          >
            Open Dashboard →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-blue-600 mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              AI-Powered Civic Intelligence
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-foreground tracking-tight leading-[1.1]">
              Don't wait for the next
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
                complaint
              </span>
              .
              <br />
              <span className="text-4xl md:text-5xl text-muted-foreground font-medium">
                Detect the problem behind it.
              </span>
            </h1>

            <p className="mt-8 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              CivicSentinel converts fragmented, unstructured citizen complaints into
              correlated, explainable early-warning signals for municipal authorities.
              Shift from reactive ticket-closing to preventive risk management.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-4 text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                <AlertTriangle className="w-5 h-5" />
                View Hotspot Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/clusters"
                className="glass rounded-2xl px-8 py-4 text-foreground font-semibold text-base hover:bg-white/70 transition-all duration-200"
              >
                Browse Clusters
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl" />
      </section>

      {/* Stats */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="glass-strong rounded-3xl p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">How It Works</h2>
            <p className="mt-3 text-muted-foreground">
              From raw complaints to actionable intelligence in three steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Ingest",
                desc: "Collect complaints from existing grievance platforms via API, webhook, or CSV.",
                color: "from-blue-500 to-blue-400",
              },
              {
                step: "02",
                title: "Correlate",
                desc: "AI extracts signals, DBSCAN clusters geo-temporal patterns, and root causes are hypothesized.",
                color: "from-cyan-500 to-teal-400",
              },
              {
                step: "03",
                title: "Act",
                desc: "Authorities see explainable risk scores, evidence-backed hypotheses, and recommended actions.",
                color: "from-teal-500 to-green-400",
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="glass rounded-2xl p-8 relative overflow-hidden"
              >
                <div
                  className={`text-6xl font-black bg-gradient-to-br ${item.color} bg-clip-text text-transparent opacity-20 absolute top-4 right-4`}
                >
                  {item.step}
                </div>
                <div className="relative">
                  <h3 className="text-xl font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Built for Municipal Intelligence</h2>
            <p className="mt-3 text-muted-foreground">
              Every feature is designed for explainability, trust, and actionability
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="glass rounded-2xl p-6 hover:bg-white/70 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core scenario */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="glass-strong rounded-3xl p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Core Scenario</h2>
            </div>
            <div className="grid md:grid-cols-4 gap-6 items-center">
              <div className="text-center md:text-left md:col-span-3">
                <p className="text-lg text-foreground font-medium">
                  27 citizens complain about water issues in Koramangala 4th Block
                </p>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  Individually, they look like isolated complaints — low pressure, road flooding,
                  pipe bursts. But CivicSentinel detects that all 27 complaints describe symptoms
                  of <strong className="text-foreground">a single aging water pipeline</strong>,
                  correlated by geography, time, and category.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Result: <span className="text-blue-600 font-medium">1 actionable cluster</span> instead
                  of 27 separate tickets. One fix instead of 27 field visits.
                </p>
              </div>
              <div className="text-center">
                <div className="text-5xl font-black text-foreground">27</div>
                <div className="text-sm text-muted-foreground mt-1">complaints</div>
                <ArrowRight className="w-5 h-5 mx-auto my-2 text-muted-foreground rotate-90 md:rotate-0" />
                <div className="text-5xl font-black bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  1
                </div>
                <div className="text-sm text-muted-foreground mt-1">cluster</div>
              </div>
            </div>
            <div className="mt-8">
              <Link
                to="/clusters"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Explore the demo clusters <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 pb-12">
        <div className="max-w-5xl mx-auto glass rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">CivicSentinel</span>
            <span className="text-xs text-muted-foreground">v1.0 MVP</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI-Powered Civic Intelligence Layer — Augment, Don't Replace
          </p>
        </div>
      </footer>
    </div>
  );
}
