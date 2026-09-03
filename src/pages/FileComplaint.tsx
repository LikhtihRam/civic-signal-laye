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
} from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/constants";

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

function saveComplaint(c: FiledComplaint) {
  const existing: FiledComplaint[] = JSON.parse(
    localStorage.getItem("civicsentinel_complaints") || "[]"
  );
  existing.unshift(c);
  localStorage.setItem("civicsentinel_complaints", JSON.stringify(existing));
}

export default function FileComplaint() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [ward, setWard] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [location, setLocation] = useState<{ lat: number; long: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!text.trim()) e.text = "Describe the issue in detail";
    if (!ward) e.ward = "Select the ward";
    if (!category) e.category = "Choose a category";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const complaint: FiledComplaint = {
      id: `USR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      raw_text: text.trim(),
      timestamp: new Date().toISOString(),
      ward,
      category,
      severity,
      lat: location?.lat ?? null,
      long: location?.long ?? null,
      status: "submitted",
    };

    saveComplaint(complaint);
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
        // Fallback to ward centroid
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

  if (submitted) {
    return (
      <div className="min-h-screen">
        <header className="glass-strong sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-foreground">CivicSentinel</span>
            </Link>
          </div>
        </header>
        <main className="max-w-xl mx-auto px-6 py-20">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-strong rounded-3xl p-10 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Complaint Filed Successfully
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Your complaint has been submitted and will be processed by our
              civic intelligence engine. It will be correlated with other
              complaints in the area to detect emerging patterns.
            </p>
            <div className="glass rounded-xl p-4 mb-8 text-left">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Ward</span>
                  <p className="font-medium text-foreground">{ward}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Category</span>
                  <p className="font-medium text-foreground">
                    {CATEGORY_LABELS[category] || category}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Severity</span>
                  <p className="font-medium text-foreground">{severity}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium text-blue-600">Submitted</p>
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
                }}
                className="glass rounded-xl px-5 py-2.5 text-sm font-medium text-foreground hover:bg-white/70 transition-all"
              >
                File Another
              </button>
              <Link
                to="/my-complaints"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
              >
                View My Complaints
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
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
          <Link
            to="/my-complaints"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            My Complaints →
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">
            File a Complaint
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Report a civic issue in your area. Your complaint will be
            automatically analyzed, correlated with similar reports, and
            surfaced to the relevant municipal authorities.
          </p>
        </motion.div>

        {/* Form */}
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
              placeholder="Describe the civic issue you're experiencing — location details, how long it's been going on, how it affects you and your neighborhood..."
              rows={5}
              className="w-full bg-white/40 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 border border-white/30 outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all resize-none"
            />
            {errors.text && (
              <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.text}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Be specific — include landmarks, duration, and impact. Your
              description will be analyzed by AI to extract key signals.
            </p>
          </div>

          {/* Ward + Category */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Ward */}
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
                    const wardCoords: Record<string, { lat: number; long: number }> = {
                      "Koramangala 4th Block": { lat: 12.9352, long: 77.6245 },
                      "Koramangala 1st Block": { lat: 12.938, long: 77.62 },
                      Indiranagar: { lat: 12.9784, long: 77.6408 },
                      "Whitefield Main Road": { lat: 12.9698, long: 77.75 },
                      "Jayanagar 4th T Block": { lat: 12.922, long: 77.585 },
                    };
                    if (wardCoords[e.target.value]) setLocation(wardCoords[e.target.value]);
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

            {/* Category */}
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
                Enable location sharing for more precise clustering. If not
                available, we'll use your ward centroid.
              </p>
            )}
          </div>

          {/* Privacy notice */}
          <div className="glass rounded-xl p-4 border-l-4 border-blue-400/40">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Privacy protected:</strong>{" "}
              Your personal information (name, phone) is masked before AI
              processing. Complaint text is analyzed for civic signals only.
              Your identity is never shared in cluster reports.
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
              Submit Complaint
            </button>
          </div>
        </motion.form>
      </main>
    </div>
  );
}
