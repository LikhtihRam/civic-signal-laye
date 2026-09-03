import { useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  ExternalLink,
  Shield,
  Zap,
} from "lucide-react";
import { getGeminiKey, setGeminiKey, clearGeminiKey } from "@/lib/gemini";

export default function Settings() {
  const [key, setKey] = useState(getGeminiKey() || "");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  const hasKey = !!getGeminiKey();

  const handleSave = () => {
    if (key.trim()) {
      setGeminiKey(key.trim());
    } else {
      clearGeminiKey();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!key.trim()) return;
    setGeminiKey(key.trim());
    setTesting(true);
    setTestResult(null);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key.trim()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with only: OK" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      setTestResult(res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    }
    setTesting(false);
  };

  return (
    <div className="min-h-screen">
      <header className="glass-strong sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
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

      <main className="max-w-2xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground mb-8">
            Configure your CivicSentinel experience.
          </p>
        </motion.div>

        {/* Gemini API Key */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Gemini API Key</h2>
              <p className="text-xs text-muted-foreground">
                Enables AI-powered complaint analysis
              </p>
            </div>
            {hasKey && (
              <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/10 text-green-600 text-xs font-medium border border-green-500/20">
                <CheckCircle className="w-3 h-3" /> Configured
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-white/40 rounded-xl px-4 py-3 pr-20 text-sm text-foreground font-mono placeholder:text-muted-foreground/50 border border-white/30 outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/50 text-muted-foreground transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
              >
                {saved ? "✓ Saved" : "Save Key"}
              </button>
              <button
                onClick={handleTest}
                disabled={!key.trim() || testing}
                className="glass rounded-xl px-5 py-2 text-sm font-medium text-foreground hover:bg-white/70 transition-all disabled:opacity-40"
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              {testResult === "ok" && (
                <span className="text-xs text-green-600 font-medium">Connected ✓</span>
              )}
              {testResult === "fail" && (
                <span className="text-xs text-red-500 font-medium">Connection failed</span>
              )}
            </div>

            {/* How to get a key */}
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
              <h3 className="text-xs font-semibold text-violet-600 mb-2">
                How to get a Gemini API Key
              </h3>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>
                  Go to{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener"
                    className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                  >
                    Google AI Studio <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Sign in with your Google account</li>
                <li>Click "Create API Key" and select a project</li>
                <li>Copy the key and paste it above</li>
              </ol>
              <p className="text-[10px] text-muted-foreground mt-2">
                Free tier includes 15 requests/minute, 1,500 requests/day.
                Key is stored locally — never sent to any server.
              </p>
            </div>
          </div>
        </motion.div>

        {/* What AI features enable */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-6 mb-6"
        >
          <h2 className="text-base font-bold text-foreground mb-4">
            What AI Enables
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              {
                icon: <Zap className="w-4 h-4" />,
                title: "Smart Extraction",
                desc: "Auto-classify category, severity, urgency from complaint text",
                on: !!getGeminiKey(),
              },
              {
                icon: <Shield className="w-4 h-4" />,
                title: "Root Cause Analysis",
                desc: "AI-generated probable causes with confidence levels",
                on: !!getGeminiKey(),
              },
              {
                icon: <Zap className="w-4 h-4" />,
                title: "Resolution Timeline",
                desc: "Accurate ETA based on category, severity, and similar cases",
                on: !!getGeminiKey(),
              },
              {
                icon: <Shield className="w-4 h-4" />,
                title: "Smart Clustering",
                desc: "Better correlation of related complaints across your area",
                on: !!getGeminiKey(),
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/30 border border-white/20"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    f.on
                      ? "bg-green-500/10 text-green-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {f.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
          {!getGeminiKey() && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Add your Gemini API key above to enable all AI features.
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
