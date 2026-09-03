import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";

// Lazy load route components
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Clusters = lazy(() => import("./pages/Clusters.tsx"));
const ClusterDetail = lazy(() => import("./pages/ClusterDetail.tsx"));
const FileComplaint = lazy(() => import("./pages/FileComplaint.tsx"));
const MyComplaints = lazy(() => import("./pages/MyComplaints.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-strong rounded-2xl px-8 py-6 text-muted-foreground animate-pulse">
        Loading CivicSentinel...
      </div>
    </div>
  );
}

class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn("[VlyToolbar]", err.message); }
  render() { return this.state.hasError ? null : this.props.children; }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "Unknown error" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass-strong rounded-2xl max-w-lg text-center p-8">
            <p className="text-sm font-semibold text-foreground">Something went wrong</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/clusters" element={<Clusters />} />
            <Route path="/clusters/:id" element={<ClusterDetail />} />
            <Route path="/file-complaint" element={<FileComplaint />} />
            <Route path="/my-complaints" element={<MyComplaints />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </RootErrorBoundary>
  </StrictMode>,
);
