import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-strong rounded-3xl max-w-md text-center p-10">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-6xl font-black text-foreground mb-4">404</h1>
        <p className="text-lg text-muted-foreground mb-6">
          This page could not be found.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-3 text-white font-medium text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
