import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCamera } from "@/hooks/use-camera";
import { useHandLandmarker } from "@/hooks/use-hand-landmarker";
import { useSpeech } from "@/hooks/use-speech";
import { logActivity } from "@/lib/activity";
import { SIGN_VOCABULARY, classifyGesture } from "@/lib/sign-classifier";
import {
  MAX_PER_SIGN,
  classifyCustom,
  loadCustomSigns,
  saveCustomSigns,
  summarize,
  toFeatures,
} from "@/lib/custom-signs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Circle,
  Copy,
  Eraser,
  Hand,
  Loader2,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import { useI18n } from "@/i18n";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const STABLE_FRAMES = 6; // same gesture this many frames in a row before it is accepted
const NO_HAND_RESET_FRAMES = 20; // frames without a hand before the same sign can repeat
const RECORD_TARGET = 80; // recording stops by itself after this many frames are captured

function drawHand(canvas, video, landmarks) {
  if (!canvas || !video) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 3;
  HAND_CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  });
  ctx.fillStyle = "#ef4444";
  landmarks.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

export default function SignLanguage() {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } = useCamera();
  const { speak, stop: stopSpeech } = useSpeech();
  const { isReady, isLoading: isProcessing, error: modelError, load, detect } = useHandLandmarker();
  const [sentence, setSentence] = useState("");
  const [currentSign, setCurrentSign] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const canvasRef = useRef(null);
  const candidateRef = useRef({ label: "", count: 0 });
  const lastCommittedRef = useRef("");
  const noHandRef = useRef(0);
  const signCountRef = useRef(0);
  const sentenceRef = useRef("");

  // ---- Taught signs ----
  const customRef = useRef({});
  const [customList, setCustomList] = useState(() => {
    customRef.current = loadCustomSigns();
    return summarize(customRef.current);
  });
  const [signName, setSignName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recCount, setRecCount] = useState(0);
  const [noHandRec, setNoHandRec] = useState(false);
  const [recMsg, setRecMsg] = useState("");
  const recordingRef = useRef(false);
  const recNameRef = useRef("");
  const recBufferRef = useRef([]);
  const capturedRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    sentenceRef.current = sentence;
  }, [sentence]);

  // Save signs translated so far as one activity record
  const flushSigns = useCallback(() => {
    const count = signCountRef.current;
    signCountRef.current = 0;
    if (count === 0) return;
    logActivity({
      feature: "sign-language",
      action: "translate",
      title:
        count > 1
          ? tRef.current("Translated {n} signs", { n: count })
          : tRef.current("Translated 1 sign"),
      summary: sentenceRef.current.slice(0, 120),
      count,
    });
  }, []);

  // Stop recording and save what was captured. The new sign is detected immediately after this.
  const finishRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    setNoHandRec(false);
    const label = recNameRef.current;
    const buf = recBufferRef.current;
    const frames = capturedRef.current;
    recBufferRef.current = [];
    if (!label || buf.length === 0) {
      setRecMsg(tRef.current("No hand was seen, so nothing was saved."));
      return;
    }
    const cur = customRef.current;
    cur[label] = [...(cur[label] || []), ...buf].slice(-MAX_PER_SIGN);
    const ok = saveCustomSigns(cur);
    setCustomList(summarize(cur));
    candidateRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";
    setRecMsg(
      ok
        ? tRef.current("Saved {n} samples for {label}. Show the sign to test it.", { n: frames, label })
        : tRef.current("Could not save to this browser (storage is full or blocked)."),
    );
  }, []);

  useEffect(() => {
    return () => {
      flushSigns();
      finishRecording();
    };
  }, [flushSigns, finishRecording]);

  // Load the hand model when the page opens
  useEffect(() => {
    load();
  }, [load]);

  const handleLandmarks = useCallback(
    (landmarks) => {
      const rec = recordingRef.current;

      if (!landmarks) {
        if (rec) setNoHandRec(true);
        noHandRef.current += 1;
        candidateRef.current = { label: "", count: 0 };
        if (noHandRef.current > NO_HAND_RESET_FRAMES) {
          lastCommittedRef.current = "";
          setCurrentSign(null);
        }
        return;
      }
      noHandRef.current = 0;

      const video = videoRef.current;
      const aspect = video && video.videoHeight ? video.videoWidth / video.videoHeight : 1;

      // Recording mode: save the hand shape (plus a mirrored copy for the other hand)
      if (rec) {
        setNoHandRec(false);
        setCurrentSign(null);
        frameRef.current += 1;
        if (frameRef.current % 2 === 0) {
          recBufferRef.current.push(toFeatures(landmarks, aspect, false));
          recBufferRef.current.push(toFeatures(landmarks, aspect, true));
          capturedRef.current += 1;
          setRecCount(capturedRef.current);
          if (capturedRef.current >= RECORD_TARGET) finishRecording();
        }
        return;
      }

      // Taught signs first, then the built-in gestures
      let gesture = classifyCustom(customRef.current, toFeatures(landmarks, aspect, false));
      const isCustom = gesture.label !== "UNKNOWN";
      if (!isCustom) gesture = classifyGesture(landmarks);

      if (gesture.label === "UNKNOWN" || gesture.confidence <= 0.5) {
        candidateRef.current = { label: "", count: 0 };
        lastCommittedRef.current = ""; // a transition between signs lets the next one register
        setCurrentSign(null);
        return;
      }

      const key = `${isCustom ? "custom" : "builtin"}:${gesture.label}`;
      const text = isCustom
        ? gesture.label
        : tRef.current(SIGN_VOCABULARY[gesture.label] || gesture.label);
      setCurrentSign(text);
      setConfidence(Math.round(gesture.confidence * 100) / 100);

      // Stability check: accept a sign only after it is held for several frames
      const cand = candidateRef.current;
      candidateRef.current =
        cand.label === key ? { label: key, count: cand.count + 1 } : { label: key, count: 1 };

      if (candidateRef.current.count >= STABLE_FRAMES && lastCommittedRef.current !== key) {
        lastCommittedRef.current = key;
        setSentence((prev) => (prev ? `${prev} ${text}` : text));
        signCountRef.current += 1;
      }
    },
    [finishRecording, videoRef],
  );

  // Real-time loop: run the hand model on every new video frame
  useEffect(() => {
    if (!isActive || !isReady) return;
    let raf;
    let cancelled = false;
    let lastVideoTime = -1;

    const loop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const landmarks = detect(video, performance.now());
        drawHand(canvasRef.current, video, landmarks);
        handleLandmarks(landmarks);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isActive, isReady, detect, videoRef, handleLandmarks]);

  const handleStart = async () => {
    candidateRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";
    noHandRef.current = 0;
    await startCamera();
  };

  const handleStop = () => {
    finishRecording();
    flushSigns();
    stopCamera();
    stopSpeech();
    setCurrentSign(null);
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSpeak = () => {
    if (sentence) {
      speak(sentence);
      flushSigns();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sentence);
  };

  const handleClear = () => {
    flushSigns();
    setSentence("");
    candidateRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";
  };

  const toggleRecording = () => {
    if (recordingRef.current) {
      finishRecording();
      return;
    }
    if (!isActive) return setRecMsg(t("Start the camera first."));
    const name = signName.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name) return setRecMsg(t("Enter a name for the sign."));
    recNameRef.current = name;
    recBufferRef.current = [];
    capturedRef.current = 0;
    frameRef.current = 0;
    setRecCount(0);
    setRecMsg("");
    setCurrentSign(null);
    recordingRef.current = true;
    setRecording(true);
  };

  const removeSign = (label) => {
    delete customRef.current[label];
    saveCustomSigns(customRef.current);
    setCustomList(summarize(customRef.current));
    candidateRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{t("Sign Language Translator")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("Translate hand gestures into text and speech using AI-powered computer vision.")}</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Camera */}
              <Card className="border-border/60 shadow-none overflow-hidden">
                <CardContent className="relative aspect-[4/3] bg-black/5 p-0">
                  <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    playsInline
                    muted
                    aria-label={t("Camera feed for sign language detection")}
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
                  {!isActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <Hand className="mb-3 size-12 opacity-40" aria-hidden="true" />
                      <p className="text-sm font-medium">{t("Camera is off")}</p>
                      <p className="mt-1 text-xs opacity-60">{t("Start the camera to begin sign detection")}</p>
                    </div>
                  )}
                  {isActive && recording && (
                    <div className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs text-white" role="status">
                      {noHandRec
                        ? t("● REC: no hand detected")
                        : `● REC ${recNameRef.current} · ${recCount}/${RECORD_TARGET}`}
                    </div>
                  )}
                  {isActive && !recording && currentSign && (
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl bg-black/70 px-5 py-3 text-white backdrop-blur-sm">
                      <div>
                        <p className="text-xs opacity-70">{t("Detected Sign")}</p>
                        <p className="text-xl font-bold tracking-wide">{currentSign}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs opacity-70">{t("Confidence")}</p>
                        <p className="text-lg font-semibold">{(confidence * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {cameraError && (
                <p className="text-sm text-destructive" role="alert">{cameraError}</p>
              )}
              {modelError && (
                <p className="text-sm text-destructive" role="alert">
                  {modelError}{" "}
                  <button type="button" onClick={load} className="underline cursor-pointer">{t("Retry")}</button>
                </p>
              )}

              {/* Controls */}
              <div className="flex flex-wrap gap-3">
                {!isActive ? (
                  <Button onClick={handleStart} className="cursor-pointer gap-2" aria-label={t("Start camera")} disabled={!isReady}>
                    <Camera className="size-4" />{" "}{t("Start Camera")}</Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="cursor-pointer gap-2" aria-label={t("Stop camera")}>
                    <CameraOff className="size-4" />{" "}{t("Stop Camera")}</Button>
                )}
                <Button onClick={handleSpeak} variant="outline" disabled={!sentence} className="cursor-pointer gap-2" aria-label={t("Speak sentence")}>
                  <Volume2 className="size-4" />{" "}{t("Speak")}</Button>
                <Button onClick={handleCopy} variant="outline" disabled={!sentence} className="cursor-pointer gap-2" aria-label={t("Copy sentence")}>
                  <Copy className="size-4" />{" "}{t("Copy")}</Button>
                <Button onClick={handleClear} variant="outline" disabled={!sentence} className="cursor-pointer gap-2" aria-label={t("Clear sentence")}>
                  <Eraser className="size-4" />{" "}{t("Clear")}</Button>
              </div>
            </div>

            {/* Sentence display */}
            <div className="space-y-4">
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Recognized Sentence")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="min-h-[120px] rounded-lg border border-border/60 bg-muted/50 p-4"
                    role="status"
                    aria-live="polite"
                    aria-label={t("Recognized sign language text")}
                  >
                    {sentence ? (
                      <p className="text-sm leading-relaxed">{sentence}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("Signs will appear here as they are detected…")}</p>
                    )}
                  </div>
                  {isProcessing && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" />{t("Loading hand detection model… (first time takes a few seconds)")}</div>
                  )}
                </CardContent>
              </Card>

              {/* Teach a new sign */}
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Teach a new sign")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {t("Start the camera, type a name, press Record and hold the sign in view. Slowly tilt and move your hand a little. It stops by itself, saves, and is detected right away. Record again with a different angle or distance to make it more reliable.")}
                  </p>
                  <input
                    type="text"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                    placeholder={t("Sign name, e.g. Thank you")}
                    aria-label={t("Sign name")}
                    disabled={recording}
                    className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
                  />
                  <Button
                    onClick={toggleRecording}
                    variant={recording ? "destructive" : "default"}
                    className="cursor-pointer gap-2"
                  >
                    {recording ? <Square className="size-4" /> : <Circle className="size-4" />}{" "}
                    {recording ? t("Stop recording") : t("Record")}
                  </Button>
                  {recMsg && (
                    <p className="text-xs text-muted-foreground" role="status" aria-live="polite">{recMsg}</p>
                  )}
                  {customList.length > 0 && (
                    <ul className="space-y-1.5 pt-1" role="list" aria-label={t("Your taught signs")}>
                      {customList.map(({ label, count }) => (
                        <li key={label} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{label}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {count} {t("samples")}
                            <button
                              type="button"
                              onClick={() => removeSign(label)}
                              aria-label={`${t("Delete")} ${label}`}
                              className="cursor-pointer rounded p-1 hover:bg-muted"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Sign reference */}
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Supported Signs")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5" role="list" aria-label={t("Supported sign gestures")}>
                    {Object.entries(SIGN_VOCABULARY).map(([gesture, sign]) => (
                      <li key={gesture} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t(gesture.replace(/_/g, " "))}</span>
                        <span className="font-medium">{t(sign)}</span>
                      </li>
                    ))}
                    {customList.map(({ label }) => (
                      <li key={`custom-${label}`} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("Taught")}</span>
                        <span className="font-medium">{label}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}