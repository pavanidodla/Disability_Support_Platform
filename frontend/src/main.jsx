import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VoiceAssistantProvider } from "@/components/VoiceAssistant";
import { LanguageProvider } from "@/i18n";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

const Landing = lazy(() => import("./pages/Landing.jsx"));
const AuthPage = lazy(() => import("./pages/Auth.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const ObjectDetection = lazy(() => import("./pages/ObjectDetection.jsx"));
const ReadAloud = lazy(() => import("./pages/ReadAloud.jsx"));
const SignLanguage = lazy(() => import("./pages/SignLanguage.jsx"));
const VoiceCommands = lazy(() => import("./pages/VoiceCommands.jsx"));
const History = lazy(() => import("./pages/History.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

class RootErrorBoundary extends React.Component {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err) {
    console.error("[App] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanguageProvider>
    <RootErrorBoundary>
      <BrowserRouter>
        <RouteSyncer />
        <VoiceAssistantProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/object-detection" element={<RequireAuth><ObjectDetection /></RequireAuth>} />
            <Route path="/read-aloud" element={<RequireAuth><ReadAloud /></RequireAuth>} />
            <Route path="/sign-language" element={<RequireAuth><SignLanguage /></RequireAuth>} />
            <Route path="/voice-commands" element={<RequireAuth><VoiceCommands /></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><History /></RequireAuth>} />
            <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </VoiceAssistantProvider>
        <Toaster />
      </BrowserRouter>
    </RootErrorBoundary>
    </LanguageProvider>
  </StrictMode>,
);
