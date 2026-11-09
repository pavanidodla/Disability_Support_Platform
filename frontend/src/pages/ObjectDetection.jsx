import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useCamera } from "@/hooks/use-camera";
import { useObjectDetection } from "@/hooks/use-object-detection";
import { useSpeech } from "@/hooks/use-speech";
import { objectLabel } from "@/i18n/object-labels";
import { analyzeScene, formatGuidance } from "@/lib/guidance";
import { logActivity } from "@/lib/activity";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Octagon,
  Camera,
  CameraOff,
  Loader2,
  Settings,
  Volume2,
  VolumeX,
  Brain,
} from "lucide-react";
import { useI18n } from "@/i18n";

const guidanceStyles = {
  danger: { box: "border-red-500/40 bg-red-500/10", text: "text-red-600 dark:text-red-400" },
  warning: { box: "border-amber-500/40 bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  clear: { box: "border-green-500/30 bg-green-500/5", text: "text-green-600 dark:text-green-400" },
};

export default function ObjectDetection() {
  const { t, lang } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } = useCamera();
  const { isSpeaking, speak, stop: stopSpeech } = useSpeech();
  const { isModelLoaded, isLoading: modelLoading, loadModel, detect } = useObjectDetection();
  const [detections, setDetections] = useState([]);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.4);
  const [showSettings, setShowSettings] = useState(false);
  const canvasRef = useRef(null);
  const [guidance, setGuidance] = useState(null);
  const guidanceSpeechRef = useRef({ key: "clear|", time: 0 });

  // Load model on mount
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  const drawDetections = useCallback(
    (dets, guide) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      dets.forEach((det) => {
        const x = det.bbox.x;
        const y = det.bbox.y;
        const w = det.bbox.w;
        const h = det.bbox.h;

        // Color based on confidence
        let color = "#f59e0b"; // amber for low
        if (det.confidence > 0.7) color = "#22c55e"; // green for high
        else if (det.confidence > 0.5) color = "#3b82f6"; // blue for medium

        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Draw corner brackets
        const cornerLen = 15;
        ctx.lineWidth = 4;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerLen, y);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + w - cornerLen, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + cornerLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x, y + h - cornerLen);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + cornerLen, y + h);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + w - cornerLen, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - cornerLen);
        ctx.stroke();

        // Label background
        const label = `${det.labelText ?? det.label} · ${det.distanceText ?? det.distance}`;
        ctx.font = "bold 14px system-ui, sans-serif";
        const metrics = ctx.measureText(label);
        const labelH = 22;
        ctx.fillStyle = color + "dd";
        ctx.beginPath();
        ctx.roundRect(x, y - labelH - 4, metrics.width + 14, labelH, 4);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(label, x + 7, y - 7);
      });

      // Navigation lanes: left | ahead | right
      ctx.save();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 2;
      [1 / 3, 2 / 3].forEach((f) => {
        ctx.beginPath();
        ctx.moveTo(canvas.width * f, 0);
        ctx.lineTo(canvas.width * f, canvas.height);
        ctx.stroke();
      });
      ctx.restore();

      // Direction indicator
      if (guide?.direction) {
        const text =
          guide.direction === "left"
            ? `◀  ${t("MOVE LEFT")}`
            : guide.direction === "right"
              ? `${t("MOVE RIGHT")}  ▶`
              : `■  ${t("STOP")}`;
        ctx.font = "bold 26px system-ui, sans-serif";
        const w = ctx.measureText(text).width + 36;
        const h = 46;
        const x = guide.direction === "left" ? 16 : guide.direction === "right" ? canvas.width - w - 16 : (canvas.width - w) / 2;
        const y = canvas.height - h - 16;
        ctx.fillStyle = guide.severity === "danger" ? "rgba(220,38,38,0.92)" : "rgba(217,119,6,0.92)";
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 10);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(text, x + 18, y + 33);
      }
    },
    [videoRef, t],
  );

  // Keep latest settings in a ref so the detection loop never restarts when a slider moves
  const settingsRef = useRef({ confidenceThreshold, voiceOn, speechRate });
  useEffect(() => {
    settingsRef.current = { confidenceThreshold, voiceOn, speechRate };
  }, [confidenceThreshold, voiceOn, speechRate]);

  // Save one activity record per camera session (unique object types seen)
  const seenLabelsRef = useRef(new Set());
  const flushSession = useCallback(() => {
    const labels = [...seenLabelsRef.current];
    seenLabelsRef.current = new Set();
    if (labels.length === 0) return;
    logActivity({
      feature: "object-detection",
      action: "session",
      title:
        labels.length > 1
          ? tRef.current("Detected {n} object types", { n: labels.length })
          : tRef.current("Detected 1 object type"),
      summary: labels.slice(0, 8).join(", "),
      count: labels.length,
    });
  }, []);

  useEffect(() => {
    return () => flushSession();
  }, [flushSession]);

  const handleStart = async () => {
    guidanceSpeechRef.current = { key: "clear|", time: 0 };
    setGuidance(null);
    await startCamera();
  };

  const handleStop = () => {
    flushSession();
    stopCamera();
    stopSpeech();
    setDetections([]);
    setGuidance(null);
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Continuous detection loop (next run starts only after the previous one finishes)
  useEffect(() => {
    if (!isActive || !isModelLoaded) return;
    let cancelled = false;
    let timer;

    const tick = async () => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        const { confidenceThreshold: minScore, voiceOn: voice, speechRate: rate } = settingsRef.current;
        const results = await detect(video);
        if (cancelled) return;

        const filtered = results
          .filter((d) => d.confidence >= minScore)
          .sort((a, b) => b.confidence - a.confidence);
        filtered.forEach((d) => seenLabelsRef.current.add(d.label));
        const g = analyzeScene(filtered, video.videoWidth, video.videoHeight);
        const text = formatGuidance(g, t, lang); // message + spoken sentence in the current language
        const items = g.items.map((it) => ({
          ...it,
          labelText: objectLabel(it.label, lang),
          distanceText: t(it.distance),
        }));
        const view = { ...g, ...text };
        setDetections(items);
        setGuidance(view);
        drawDetections(items, view);

        // Speak guidance when it changes, and repeat while an obstacle stays in the way
        if (voice) {
          const now = Date.now();
          const last = guidanceSpeechRef.current;
          const changed = g.key !== last.key;
          const repeatAfter = g.severity === "danger" ? 3500 : g.severity === "warning" ? 6000 : Infinity;
          if ((changed && now - last.time > 1200) || (g.severity !== "clear" && now - last.time > repeatAfter)) {
            guidanceSpeechRef.current = { key: g.key, time: now };
            speak(text.spoken, { rate });
          }
        }
      }
      if (!cancelled) timer = setTimeout(tick, 300);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isActive, isModelLoaded, videoRef, detect, drawDetections, speak, t]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{t("Object Detection")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("Identify any object using AI-powered computer vision (TensorFlow.js COCO-SSD).")}</p>
          </header>

          {/* Model status */}
          <div className="mb-4">
            {!isModelLoaded && (
              <Card className="border-amber-500/30 bg-amber-500/5 shadow-none">
                <CardContent className="flex items-center gap-3 py-3">
                  {modelLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-amber-500" />
                      <span className="text-sm text-amber-600">{t("Loading AI model… (first time takes ~10 seconds)")}</span>
                    </>
                  ) : (
                    <>
                      <Brain className="size-4 text-amber-500" />
                      <span className="text-sm text-amber-600">{t("Model not loaded. Click to retry.")}</span>
                      <Button size="sm" variant="outline" onClick={loadModel} className="ml-auto">{t("Retry")}</Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
            {isModelLoaded && (
              <Card className="border-green-500/30 bg-green-500/5 shadow-none">
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="size-2 rounded-full bg-green-500" />
                  <span className="text-sm text-green-600">{t("AI Model ready — detecting objects in real-time")}</span>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Camera view */}
            <div className="lg:col-span-2">
              <Card className="border-border/60 shadow-none overflow-hidden">
                <CardContent className="relative aspect-[4/3] bg-black/5 p-0">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    playsInline
                    muted
                    aria-label={t("Camera feed for object detection")}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                  />
                  {!isActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <Camera className="mb-3 size-12 opacity-40" aria-hidden="true" />
                      <p className="text-sm font-medium">{t("Camera is off")}</p>
                      <p className="mt-1 text-xs opacity-60">{t("Start the camera to detect any objects around you")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation guidance */}
              {isActive && guidance && (
                <Card className={`mt-4 shadow-none ${guidanceStyles[guidance.severity].box}`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className={guidanceStyles[guidance.severity].text} aria-hidden="true">
                      {guidance.severity === "danger" ? (
                        <Octagon className="size-8" />
                      ) : guidance.severity === "warning" ? (
                        <AlertTriangle className="size-8" />
                      ) : (
                        <CheckCircle2 className="size-8" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-lg font-semibold ${guidanceStyles[guidance.severity].text}`}
                        role="status"
                        aria-live={guidance.severity === "danger" ? "assertive" : "polite"}
                      >
                        {guidance.message}
                      </p>
                      {guidance.sideNotes.length > 0 && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{t("Nearby: {notes}", { notes: guidance.sideNotes.join(" · ") })}</p>
                      )}
                    </div>
                    {guidance.direction === "left" && (
                      <ArrowLeft className={`size-9 shrink-0 ${guidanceStyles[guidance.severity].text}`} aria-hidden="true" />
                    )}
                    {guidance.direction === "right" && (
                      <ArrowRight className={`size-9 shrink-0 ${guidanceStyles[guidance.severity].text}`} aria-hidden="true" />
                    )}
                  </CardContent>
                </Card>
              )}

              {cameraError && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {cameraError}
                </p>
              )}

              {/* Controls */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {!isActive ? (
                  <Button onClick={handleStart} className="cursor-pointer gap-2" aria-label={t("Start camera")} disabled={!isModelLoaded}>
                    <Camera className="size-4" />{t("Start Camera")}</Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="cursor-pointer gap-2" aria-label={t("Stop camera")}>
                    <CameraOff className="size-4" />{t("Stop Camera")}</Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setVoiceOn(!voiceOn)}
                  className="cursor-pointer gap-2"
                  aria-label={voiceOn ? t("Mute voice guidance") : t("Enable voice guidance")}
                >
                  {voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                  {voiceOn ? t("Voice On") : t("Voice Off")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(!showSettings)}
                  className="cursor-pointer gap-2"
                  aria-label={t("Toggle settings")}
                >
                  <Settings className="size-4" />{t("Settings")}</Button>
              </div>

              {/* Settings panel */}
              {showSettings && (
                <Card className="mt-4 border-border/60 shadow-none">
                  <CardContent className="grid gap-5 pt-6 pb-6 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs font-medium">{t("Speech Rate: {n0}x", { n0: speechRate.toFixed(1) })}</Label>
                      <Slider
                        value={[speechRate]}
                        onValueChange={(v) => setSpeechRate(v[0])}
                        min={0.5}
                        max={2}
                        step={0.1}
                        className="mt-2"
                        aria-label={t("Speech rate")}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">{t("Confidence: {n0}%", { n0: (confidenceThreshold * 100).toFixed(0) })}</Label>
                      <Slider
                        value={[confidenceThreshold]}
                        onValueChange={(v) => setConfidenceThreshold(v[0])}
                        min={0.05}
                        max={0.9}
                        step={0.05}
                        className="mt-2"
                        aria-label={t("Confidence threshold")}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Detections sidebar */}
            <div>
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Detected Objects")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {detections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {isActive
                        ? t("Point camera at any object to detect it…")
                        : t("Start the camera to detect objects.")}
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-2" role="list" aria-label={t("Detected objects list")}>
                        {detections.map((det, i) => (
                          <li
                            key={`${det.label}-${i}`}
                            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`size-2 rounded-full ${
                                det.confidence > 0.7 ? "bg-green-500" :
                                det.confidence > 0.5 ? "bg-blue-500" : "bg-amber-500"
                              }`} />
                              <div>
                                <p className="text-sm font-medium leading-tight">{det.labelText}</p>
                                <p className="text-xs text-muted-foreground">
                                  {det.zone === "ahead" ? t("Ahead") : det.zone === "left" ? t("Left") : t("Right")} · {det.distanceText}
                                </p>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {(det.confidence * 100).toFixed(0)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                      {/* Info */}
                      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
                        <p className="font-medium text-foreground">{t("How it works:")}</p>
                        <p className="mt-1">{t("COCO-SSD detects 80 common objects: people, phones, laptops, cups, bottles, chairs, books, backpacks, animals, vehicles, and more.")}</p>
                        <p className="mt-2 font-medium text-foreground">{t("Guidance:")}</p>
                        <p className="mt-1">{t("The view is split into left, ahead and right lanes. Distance is estimated from how large an object appears. If something near is in your path, you are told to move left or right toward the clearer side.")}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {isSpeaking && (
                <Card className="mt-4 border-primary/30 bg-primary/5 shadow-none">
                  <CardContent className="flex items-center gap-3 pt-4 pb-4">
                    <div className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                    <span className="text-xs font-medium text-primary">{t("Speaking guidance…")}</span>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}