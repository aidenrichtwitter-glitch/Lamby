// AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
// Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
// Read docs/no-reply-system.md for the no-reply protocol.
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Evolution from "./pages/Evolution";
import EvolutionCycle from "./pages/PatternAnalysis";
import GrokBridge from "./pages/GrokBridge";
import Calibration from "./pages/Calibration";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initErrorReporter, onRecoveryAttempt } from "./lib/error-reporter";
import { toast } from "sonner";

const queryClient = new QueryClient();

function ErrorReporterInit() {
  useEffect(() => {
    initErrorReporter();
    const unsub = onRecoveryAttempt((_report, result) => {
      if (result.attempted && result.success) {
        toast.success("Auto-fixed: " + result.detail, { duration: 4000 });
      } else if (result.attempted && !result.success) {
        toast.error("Auto-fix failed: " + result.detail, { duration: 5000 });
      }
    });
    return unsub;
  }, []);
  return null;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorReporterInit />
        <Toaster />
        <Sonner />
        {window.location.protocol === 'file:' ? (
          <HashRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<GrokBridge />} />
                <Route path="/home" element={<Index />} />
                <Route path="/evolution" element={<Evolution />} />
                <Route path="/evolution-cycle" element={<EvolutionCycle />} />
                <Route path="/calibrate" element={<Calibration />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </HashRouter>
        ) : (
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppLayout>
              <Routes>
                <Route path="/" element={<GrokBridge />} />
                <Route path="/home" element={<Index />} />
                <Route path="/evolution" element={<Evolution />} />
                <Route path="/evolution-cycle" element={<EvolutionCycle />} />
                <Route path="/calibrate" element={<Calibration />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
