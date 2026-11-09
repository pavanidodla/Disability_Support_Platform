import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import {
  Clock,
  Eye,
  FileText,
  Hand,
  Mic,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/i18n";

const typeConfig = {
  detection: { icon: Eye, label: "Object Detection", color: "text-blue-600" },
  ocr: { icon: FileText, label: "Read Aloud", color: "text-emerald-600" },
  sign_language: { icon: Hand, label: "Sign Language", color: "text-violet-600" },
  voice_command: { icon: Mic, label: "Voice Command", color: "text-rose-600" },
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const filters = [
  { value: "all", label: "All" },
  { value: "detection", label: "Object Detection" },
  { value: "ocr", label: "Read Aloud" },
  { value: "sign_language", label: "Sign Language" },
  { value: "voice_command", label: "Voice Commands" },
];

export default function History() {
  const { t, lang } = useI18n();
  const [activeFilter, setActiveFilter] = useState("all");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessai_token");
    if (!token) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (activeFilter !== "all") params.set("type", activeFilter);
    fetch(`${API_URL}/api/history?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { history: [] }))
      .then((d) => { setHistory(d.history || []); setLoading(false); })
      .catch(() => { setHistory([]); setLoading(false); });
  }, [activeFilter]);

  const clearHistory = async () => {
    const token = localStorage.getItem("accessai_token");
    try {
      await fetch(`${API_URL}/api/history`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore network errors
    }
    setHistory([]);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t("History")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("View your activity across all AccessAI features.")}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => clearHistory()}
              className="cursor-pointer gap-2 self-start"
              disabled={!history || history.length === 0}
              aria-label={t("Clear all history")}
            >
              <Trash2 className="size-4" />{" "}{t("Clear History")}</Button>
          </header>

          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label={t("Filter history by type")}>
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={activeFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(f.value)}
                className="cursor-pointer"
                role="tab"
                aria-selected={activeFilter === f.value}
                aria-label={t("Filter by {label}", { label: f.label })}
              >
                {t(f.label)}
              </Button>
            ))}
          </div>

          {/* Activity list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="border-border/60 shadow-none">
                  <CardContent className="flex items-center gap-3 pt-4 pb-4">
                    <div className="size-9 animate-pulse rounded-lg bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : history.length === 0 ? (
            <Card className="border-border/60 shadow-none">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <Clock className="mb-3 size-12 text-muted-foreground/30" aria-hidden="true" />
                <p className="text-sm font-medium text-muted-foreground">{t("No activity yet")}</p>
                <p className="mt-1 text-xs text-muted-foreground/70">{t("Use any AccessAI feature and your activity will appear here.")}</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3" role="list" aria-label={t("Activity history")}>
              {history.map((item) => {
                const config = typeConfig[item.type] || typeConfig.detection;
                const Icon = config.icon;
                return (
                  <li key={item._id}>
                    <Card className="border-border/60 shadow-none">
                      <CardContent className="flex items-start gap-3 pt-4 pb-4">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4.5" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <span className={`shrink-0 text-xs font-medium ${config.color}`}>
                              {t(config.label)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground truncate">
                            {item.summary}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground/70">
                            {new Date(item.timestamp).toLocaleString(lang)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
