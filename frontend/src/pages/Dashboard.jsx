import { AccessibilityOnboarding } from "@/components/AccessibilityOnboarding";
import { AppLayout } from "@/components/AppLayout";

import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import {
  Eye,
  FileText,
  Hand,
  Mic,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useI18n } from "@/i18n";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const features = [
  {
    to: "/object-detection",
    icon: Eye,
    title: "Object Detection",
    desc: "Understand your surroundings using AI.",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    to: "/read-aloud",
    icon: FileText,
    title: "Read Aloud",
    desc: "Read documents, labels and printed text.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    to: "/sign-language",
    icon: Hand,
    title: "Sign Language",
    desc: "Translate recognized sign gestures into text/speech.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    to: "/voice-commands",
    icon: Mic,
    title: "Voice Commands",
    desc: "Navigate AccessAI hands-free.",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
  },
];

const typeIcons = {
  detection: Eye,
  ocr: FileText,
  sign_language: Hand,
  voice_command: Mic,
};

const typeLabels = {
  detection: "Object Detection",
  ocr: "Read Aloud",
  sign_language: "Sign Language",
  voice_command: "Voice Command",
};

const emptyStats = {
  objectsDetected: 0,
  documentsRead: 0,
  signsTranslated: 0,
  voiceCommands: 0,
  recentActivity: [],
};

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  const hasPrefs = user?.accessibilityPreferences != null;
  const loading = stats === null;

  useEffect(() => {
    const token = localStorage.getItem("accessai_token");
    if (!token) return;
    fetch(`${API_URL}/api/history/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const s = data.stats ?? data;
          setStats({
            objectsDetected: s.objectsDetected ?? 0,
            documentsRead: s.documentsRead ?? 0,
            signsTranslated: s.signsTranslated ?? 0,
            voiceCommands: s.voiceCommands ?? 0,
            recentActivity: data.recentActivity ?? [],
          });
        } else {
          setStats(emptyStats);
        }
      })
      .catch(() => setStats(emptyStats));
  }, []);

  return (
    <AppLayout>
      {showOnboarding && !hasPrefs && (
        <AccessibilityOnboarding
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8">
            <p className="text-sm font-medium text-muted-foreground">{t("Welcome back")}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {user?.name ? t("{name}'s Dashboard", { name: user.name }) : t("Your Dashboard")}
            </h1>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Objects Detected", value: stats?.objectsDetected ?? 0, icon: Eye },
              { label: "Documents Read", value: stats?.documentsRead ?? 0, icon: FileText },
              { label: "Signs Translated", value: stats?.signsTranslated ?? 0, icon: Hand },
              { label: "Voice Commands", value: stats?.voiceCommands ?? 0, icon: Mic },
            ].map((s) => (
              <Card key={s.label} className="border-border/60 shadow-none">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t(s.label)}</p>
                      <p className="mt-1 text-2xl font-bold">
                        {loading ? "—" : s.value}
                      </p>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <s.icon className="size-5" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Feature Cards */}
          <section className="mt-8" aria-label={t("Quick access features")}>
            <h2 className="mb-4 text-lg font-semibold">{t("Features")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <Card
                  key={f.to}
                  className="group cursor-pointer border-border/60 shadow-none transition-all hover:border-primary/30 hover:shadow-sm"
                  onClick={() => navigate(f.to)}
                  role="link"
                  aria-label={t("Open {title}", { title: f.title })}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(f.to);
                    }
                  }}
                >
                  <CardContent className="flex items-start gap-4 pt-6 pb-6">
                    <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${f.bg} ${f.color} transition-colors`}>
                      <f.icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold">{t(f.title)}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t(f.desc)}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="mt-8" aria-label={t("Recent activity")}>
            <h2 className="mb-4 text-lg font-semibold">{t("Recent Activity")}</h2>
            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="border-border/60 shadow-none">
                    <CardContent className="flex items-center gap-3 pt-4 pb-4">
                      <div className="size-8 animate-pulse rounded-lg bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                        <div className="h-2.5 w-2/3 animate-pulse rounded bg-muted" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : stats?.recentActivity.length === 0 ? (
              <Card className="border-border/60 shadow-none">
                <CardContent className="flex flex-col items-center py-10 text-center">
                  <Clock className="mb-3 size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t("No activity yet.")}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">{t("Start using a feature to see your activity here.")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {stats?.recentActivity.map((item) => {
                  const Icon = typeIcons[item.type] || Eye;
                  return (
                    <Card key={item._id} className="border-border/60 shadow-none">
                      <CardContent className="flex items-center gap-3 pt-4 pb-4">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t(item.title)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t(typeLabels[item.type])} ·{" "}
                            {new Date(item.timestamp).toLocaleDateString(lang)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
