import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useI18n } from "@/i18n";

const defaultSettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  speechRate: 1.0,
  speechVolume: 1.0,
  voiceOn: true,
  detectionSensitivity: 0.5,
  confidenceThreshold: 0.6,
  cameraDeviceId: undefined,
  dataRetentionDays: 30,
};

export default function Settings() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [serverSettings] = useState(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [cameras, setCameras] = useState([]);

  useEffect(() => {
    if (serverSettings) {
      setSettings(serverSettings );
    }
  }, [serverSettings]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      setCameras(devices.filter((d) => d.kind === "videoinput"));
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Save settings locally (placeholder for backend API)
      localStorage.setItem("accessai_settings", JSON.stringify(settings));
      setSaveMessage(t("Settings saved successfully."));
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage(t("Failed to save settings."));
    } finally {
      setIsSaving(false);
    }
  };

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">{t("Settings")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("Customize your AccessAI experience.")}</p>
          </header>

          <div className="space-y-6">
            {/* Accessibility */}
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("Accessibility")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium" htmlFor="high-contrast">{t("High Contrast Mode")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("Increase color contrast for better visibility")}</p>
                  </div>
                  <Switch id="high-contrast" checked={settings.highContrast} onCheckedChange={(v) => update("highContrast", v)} aria-label={t("Toggle high contrast mode")} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium" htmlFor="large-text">{t("Large Text")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("Increase font sizes across the interface")}</p>
                  </div>
                  <Switch id="large-text" checked={settings.largeText} onCheckedChange={(v) => update("largeText", v)} aria-label={t("Toggle large text")} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium" htmlFor="reduced-motion">{t("Reduced Animation")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("Minimize motion and transitions")}</p>
                  </div>
                  <Switch id="reduced-motion" checked={settings.reducedMotion} onCheckedChange={(v) => update("reducedMotion", v)} aria-label={t("Toggle reduced motion")} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium" htmlFor="voice-feedback">{t("Voice Feedback")}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("Enable spoken feedback for actions")}</p>
                  </div>
                  <Switch id="voice-feedback" checked={settings.voiceOn} onCheckedChange={(v) => update("voiceOn", v)} aria-label={t("Toggle voice feedback")} />
                </div>
              </CardContent>
            </Card>

            {/* Speech */}
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("Speech")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-xs font-medium">{t("Speech Rate: {n0}x", { n0: settings.speechRate.toFixed(1) })}</Label>
                  <Slider
                    value={[settings.speechRate]}
                    onValueChange={(v) => update("speechRate", v[0])}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="mt-2"
                    aria-label={t("Speech rate")}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">{t("Volume: {n0}%", { n0: (settings.speechVolume * 100).toFixed(0) })}</Label>
                  <Slider
                    value={[settings.speechVolume]}
                    onValueChange={(v) => update("speechVolume", v[0])}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-2"
                    aria-label={t("Speech volume")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Camera */}
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("Camera")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-xs font-medium" htmlFor="camera-select">{t("Camera Device")}</Label>
                  <select
                    id="camera-select"
                    value={settings.cameraDeviceId || ""}
                    onChange={(e) => update("cameraDeviceId", e.target.value || undefined)}
                    className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    aria-label={t("Select camera device")}
                  >
                    <option value="">{t("Default camera")}</option>
                    {cameras.map((cam) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {t(cam.label) || t("Camera {n0}", { n0: cam.deviceId.slice(0, 8) })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium">{t("Detection Confidence: {n0}%", { n0: (settings.confidenceThreshold * 100).toFixed(0) })}</Label>
                  <Slider
                    value={[settings.confidenceThreshold]}
                    onValueChange={(v) => update("confidenceThreshold", v[0])}
                    min={0.1}
                    max={0.95}
                    step={0.05}
                    className="mt-2"
                    aria-label={t("Detection confidence threshold")}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">{t("Detection Sensitivity: {n0}%", { n0: (settings.detectionSensitivity * 100).toFixed(0) })}</Label>
                  <Slider
                    value={[settings.detectionSensitivity]}
                    onValueChange={(v) => update("detectionSensitivity", v[0])}
                    min={0.1}
                    max={1}
                    step={0.1}
                    className="mt-2"
                    aria-label={t("Detection sensitivity")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacy */}
            <Card className="border-border/60 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("Privacy")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label className="text-xs font-medium">{t("Data Retention: {dataRetentionDays} days", { dataRetentionDays: settings.dataRetentionDays })}</Label>
                  <Slider
                    value={[settings.dataRetentionDays]}
                    onValueChange={(v) => update("dataRetentionDays", v[0])}
                    min={7}
                    max={365}
                    step={1}
                    className="mt-2"
                    aria-label={t("Data retention period in days")}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{t("Activity data older than this will be eligible for cleanup.")}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong>{t("Privacy note:")}</strong>{" "}{t("Camera and microphone data is processed locally in your browser. AccessAI does not store camera frames or audio recordings unless you explicitly save a document or scan. You can delete all your data from the History page at any time.")}</p>
                </div>
              </CardContent>
            </Card>

            {/* Save */}
            <div className="flex items-center gap-4">
              <Button onClick={handleSave} disabled={isSaving} className="cursor-pointer gap-2">
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}{t("Save Settings")}</Button>
              {saveMessage && (
                <p className="text-sm text-primary" role="status" aria-live="polite">
                  {saveMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
