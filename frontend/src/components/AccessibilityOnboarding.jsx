import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  Eye,
  Hand,
  Headphones,
  Mic,
  Accessibility,
  ArrowRight,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n";

const preferences = [
  {
    key: "visualAssistance" ,
    icon: Eye,
    title: "Visual Assistance",
    desc: "Object detection, text reading, and visual guidance",
  },
  {
    key: "hearingAssistance" ,
    icon: Headphones,
    title: "Hearing Assistance",
    desc: "Sign language translation and visual alerts",
  },
  {
    key: "mobilityAssistance" ,
    icon: Hand,
    title: "Mobility Assistance",
    desc: "Voice control and hands-free navigation",
  },
  {
    key: "handsFree" ,
    icon: Mic,
    title: "Hands-Free Interaction",
    desc: "Voice commands and speech navigation",
  },
  {
    key: "generalAccessibility" ,
    icon: Accessibility,
    title: "General Accessibility",
    desc: "Enhanced contrast, larger text, and keyboard navigation",
  },
];

export function AccessibilityOnboarding({ onComplete, onSkip }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState({});
  const handleSave = async () => {
    // Save preferences locally
    localStorage.setItem(
      "accessai_preferences",
      JSON.stringify({
        visualAssistance: selected.visualAssistance ?? false,
        hearingAssistance: selected.hearingAssistance ?? false,
        mobilityAssistance: selected.mobilityAssistance ?? false,
        handsFree: selected.handsFree ?? false,
        generalAccessibility: selected.generalAccessibility ?? false,
      }),
    );
    onComplete();
  };

  const toggle = (key) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" role="dialog" aria-label={t("Accessibility preferences onboarding")} aria-modal="true">
      <Card className="w-full max-w-lg border-border/60 shadow-lg">
        <CardHeader className="relative">
          <button
            onClick={onSkip}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label={t("Skip onboarding")}
          >
            <X className="size-4" />
          </button>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Accessibility className="size-5" />
          </div>
          <CardTitle className="text-lg">{t("Welcome to AccessAI")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("Choose which features you need. This helps us personalize your experience. You can change these later in Settings.")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {preferences.map((pref) => (
            <div
              key={pref.key}
              className="flex items-center justify-between rounded-lg border border-border/60 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <pref.icon className="size-4 text-primary" aria-hidden="true" />
                <div>
                  <Label className="text-sm font-medium cursor-pointer" htmlFor={`pref-${pref.key}`}>
                    {t(pref.title)}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t(pref.desc)}</p>
                </div>
              </div>
              <Switch
                id={`pref-${pref.key}`}
                checked={selected[pref.key] ?? false}
                onCheckedChange={() => toggle(pref.key)}
                aria-label={t("Enable {title}", { title: t(pref.title) })}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} className="flex-1 cursor-pointer gap-2">{t("Save Preferences")}<ArrowRight className="size-4" />
            </Button>
            <Button onClick={onSkip} variant="outline" className="cursor-pointer">{t("Skip")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
