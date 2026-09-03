import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Send,
  MapPin,
  FileText,
  Tag,
  AlertCircle,
  CheckCircle,
  Navigation,
  X,
  Clock,
  Loader2,
  Settings,
} from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/constants";
import { extractSignals, getRootCauseEstimate, getGeminiKey } from "@/lib/gemini";
import {
  saveComplaint,
  simulateStatusProgression,
  type FiledComplaint,
} from "@/lib/complaints";

const WARDS = [
  "Koramangala 4th Block",
  "Koramangala 1st Block",
  "Indiranagar",
  "Whitefield Main Road",
  "Jayanagar 4th T Block",
];

const CATEGORIES = Object.entries(CATEGORY_LABELS)
  .filter(([k]) => k !== "other")
  .map(([value, label]) => ({ value, label }));

const SEVERITIES = [
  { value: "Low", label: "Low", desc: "Minor inconvenience" },
  { value: "Medium", label: "Medium", desc: "Ongoing daily issue" },
  { value: "High", label: "High", desc: "Widespread or health risk" },
  { value: "Critical", label: "Critical", desc: "Danger to life or safety" },
];

export default function FileComplaint() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [ward, setWard] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [location, setLocation] = useState<{ lat: number; long: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AI results (shown after submission)
  const [aiResult, setAiResult] = useState<{
    summary: string;
    estimatedDays: number;
    rootCause: string;
    department: string;
  } | null>(null);

  const hasGemini = !!getGeminiKey();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!text.trim()) e.text = "Describe the issue in detail";
    if (!ward) e.ward = "Select the ward";
    if (!category) e.category = "Choose a category";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setProcessing(true);

    // Build base complaint
    const complaintId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    let extractedCategory = category;
    let extractedSeverity = severity;
    let extractedSignals = null;
    let eta = 10;
    let rootCause = "Under investigation";
    let dept = CATEGORY_LABELS[category] || "Municipal Services";

    // Run Gemini processing if available
    if (hasGemini) {
      try {
        // Step 1: Extract signals
        extractedSignals = await extractSignals(text.trim(), ward);
        extractedCategory = extractedSignals.category || category;
        extractedSeverity = extractedSignals.severity || severity;
        eta = extractedSignals.estimated_days || 10;

        // Step 2: Get root cause + better ETA
        const rc = await getRootCauseEstimate(text.trim(), extractedCategory, extractedSeverity);
        rootCause = rc.root_cause;
        eta = rc.estimated_days || eta;
        dept = rc.department;
      } catch (err) {
        console.warn("Gemini processing failed, using fallback:", err);
      }
    } else {
      // Offline fallback
      const fallbackEta: Record<string, number> = {
        water_leakage: 5, low_pressure: 10, drainage: 8, blocked_drain: 6,
        pothole: 7, road_damage: 10, power_outage: 3, streetlight: 10,
        electrical_hazard: 2, garbage: 5, sanitation: 5, other: 10,
      };
      eta = fallbackEta[category] || 10;
    }

    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + eta);

    const complaint: FiledComplaint = {
      id: complaintId,
      raw_text: text.trim(),
      timestamp: new Date().toISOString(),
      ward,
      category: extractedCategory,
      severity: extractedSeverity,
      lat: location?.lat ?? null,
      long: location?.long ?? null,
      status: "processing",
      summary: extractedSignals?.summary || text.substring(0, 120),
      sentiment: extractedSignals?.sentiment,
      urgency_flag: extractedSignals?.urgency_flag,
      affected_population_estimate: extractedSignals?.affected_population_estimate,
      estimated_days: eta,
      estimated_date: estimatedDate.toISOString(),
      root_cause: rootCause,
      department: dept,
      eta_reasoning: hasGemini
        ? "Estimated by AI based on category, severity, and similar resolved complaints"
        : "Estimated based on typical resolution timelines",
      notifications: [
        {
          id: `notif-${Date.now()}`,
          type: "status_change",
          message: "Complaint filed and queued for AI analysis",
          timestamp: new Date().toISOString(),
          read: false,
        },
      ],
    };

    saveComplaint(complaint);
    simulateStatusProgression(complaintId);

    setAiResult({
      summary: complaint.summary || "",
      estimatedDays: eta,
      rootCause,
      department: dept,
    });
    setProcessing(false);
    setSubmitted(true);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, long: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        const wardCoords: Record<string, { lat: number; long: number }> = {
          "Koramangala 4th Block": { lat: 12.9352, long: 77.6245 },
          "Koramangala 1st Block": { lat: 12.938, long: 77.62 },
          Indiranagar: { lat: 12.9784, long: 77.6408 },
          "Whitefield Main Road": { lat: 12.9698, long: 77.75 },
          "Jayanagar 4th T Block": { lat: 12.922, long: 77.585 },
        };
        if (ward && wardCoords[ward]) setLocation(wardCoords[ward]);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  };

  // Processing spinner
  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-strong rounded-3xl p-12 text-center max-w-md"
        >
          <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            {hasGemini ? "AI is analyzing your complaint..." : "Processing complaint..."}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasGemini
              ? "Extracting signals, classifying severity, estimating resolution timeline"
              : "Classifying and estimating resolution timeline"}
          </p>
        </motion.div>
      </div>
    );
  }

  // Success screen
  if (submitted && aiResult) {
    return (
      <div className="min-h-screen">
        <header className="glass-strong sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-foreground">CivicSentinel</span>
          </div>
        </header>
        <main className="max-w-xl mx-auto px-6 py-16">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-strong rounded-3xl p-10"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              Complaint Filed Successfully
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Our civic intelligence engine has processed your complaint.
            </p>

            {/* AI Analysis Summary */}
            <div className="space-y-3 mb-6">
              {hasGemini && (
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                    AI Summary
                  </div>
                  <p className="text-sm text-foreground">{aiResult.summary}</p>
                </div>
              )}

              {/* ETA */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-bold text-foreground">
                    Estimated Resolution
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-amber-600">
                    {aiResult.estimatedDays}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {aiResult.estimatedDays === 1 ? "day" : "days"}
                  </span>
                </div>
                {aiResult.estimatedDays > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expected by{" "}
                    {new Date(Date.now() + aiResult.estimatedDays * 86400000).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "long", year: "numeric" }
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {hasGemini
                    ? "ETA estimated by AI based on category, severity, and similar resolved complaints in your area"
                    : "Estimated based on typical resolution timelines for this issue type"}
                </p>
              </div>

              {/* Root cause + department */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/40 border border-white/30">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Root Cause
                  </span>
                  <p className="text-xs text-foreground font-medium mt-1 leading-relaxed">
                    {aiResult.rootCause}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/40 border border-white/30">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Department
                  </span>
                  <p className="text-xs text-foreground font-medium mt-1">
                    {aiResult.department}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setText("");
                  setWard("");
                  setCategory("");
                  setSeverity("Medium");
                  setLocation(null);
                  setSubmitted(false);
                  setAiResult(null);
                }}
                className="glass rounded-xl px-5 py-2.5 text-sm font-medium text-foreground hover:bg-white/70 transition-all"
              >
                File Another
              </button>
              <Link
                to="/my-complaints"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
              >
                Track My Complaints
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen">
      <header className="glass-strong sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-3">
            {!hasGemini && (
              <Link
                to="/settings"
                className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
              >
                <Settings className="w-3 h-3" />
                Add AI Key
              </Link>
            )}
            <Link
              to="/my-complaints"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              My Complaints →
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">File a Complaint</h1>
          <p className="text-muted-foreground leading-relaxed">
            Report a civic issue. Our AI will analyze your complaint, estimate
            a resolution timeline, and route it to the right department.
          </p>
          {hasGemini && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Gemini AI enabled — full analysis active
            </p>
          )}
          {!hasGemini && (
            <Link to="/settings" className="text-xs text-amber-600 hover:underline mt-2 inline-flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Enable AI for smarter analysis and accurate ETAs
            </Link>
          )}
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Complaint Text */}
          <div className="glass rounded-2xl p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <FileText className="w-4 h-4 text-blue-600" />
              Describe the Issue
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe the civic issue — include location details, how long it's been going on, how it affects you and your neighborhood..."
              rows={5}
              className="w-full bg-white/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 border border-white/30 outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all resize-none"
            />
            {errors.text && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.text}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Be specific — include landmarks, duration, and impact. AI will extract key signals from your description.
            </p>
          </div>

          {/* Ward + Category */}
          <div className="grid md:grid-cols-2 gap-5">
            <div className="glass rounded-2xl p-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <MapPin className="w-4 h-4 text-blue-600" />
                Ward / Area
              </label>
              <select
                value={ward}
                onChange={(e) => {
                  setWard(e.target.value);
                  if (e.target.value) {
                    const wc: Record<string, { lat: number; long: number }> = {
                      "Koramangala 4th Block": { lat: 12.9352, long: 77.6245 },
                      "Koramangala 1st Block": { lat: 12.938, long: 77.62 },
                      Indiranagar: { lat: 12.9784, long: 77.6408 },
                      "Whitefield Main Road": { lat: 12.9698, long: 77.75 },
                      "Jayanagar 4th T Block": { lat: 12.922, long: 77.585 },
                    };
                    if (wc[e.target.value]) setLocation(wc[e.target.value]);
                  }
                }}
                className="w-full bg-white/40 rounded-xl px-4 py-3 text-sm text-foreground border border-white/30 outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all cursor-pointer appearance-none"
              >
                <option value="">Select ward...</option>
                {WARDS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
              {errors.ward && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.ward}
                </p>
              )}
            </div>

            <div className="glass rounded-2xl p-6">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Tag className="w-4 h-4 text-blue-600" />
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white/40 rounded-xl px-4 py-3 text-sm text-foreground border border-white/30 outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all cursor-pointer appearance-none"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.category}
                </p>
              )}
            </div>
          </div>

          {/* Severity */}
          <div className="glass rounded-2xl p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              Severity
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSeverity(s.value)}
                  className={`p-3 rounded-xl text-center border transition-all ${
                    severity === s.value
                      ? "bg-blue-500/15 border-blue-500/30 text-blue-600"
                      : "bg-white/30 border-white/20 text-muted-foreground hover:bg-white/50"
                  }`}
                >
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Navigation className="w-4 h-4 text-blue-600" />
                Precise Location
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <button
                type="button"
                onClick={useMyLocation}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Navigation className="w-3 h-3" />
                {locating ? "Locating..." : "Use my location"}
              </button>
            </div>
            {location ? (
              <div className="flex items-center gap-3 bg-white/40 rounded-xl px-4 py-3 border border-white/30">
                <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-foreground flex-1">
                  {location.lat.toFixed(4)}, {location.long.toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  className="p-1 rounded-lg hover:bg-white/50 text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground bg-white/20 rounded-xl px-4 py-3 border border-white/10">
                Enable location for more precise clustering. Falls back to ward centroid.
              </p>
            )}
          </div>

          {/* Privacy */}
          <div className="glass rounded-xl p-4 border-l-4 border-blue-400/40">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Privacy protected:</strong>{" "}
              Your personal information is masked before AI processing. Complaint text is
              analyzed for civic signals only. Your identity is never shared in cluster reports.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-8 py-3.5 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Send className="w-4 h-4" />
              {hasGemini ? "Submit & Analyze with AI" : "Submit Complaint"}
            </button>
          </div>
        </motion.form>
      </main>
    </div>
  );
}
