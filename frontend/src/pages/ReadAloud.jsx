import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useCamera } from "@/hooks/use-camera";
import { useSpeech } from "@/hooks/use-speech";
import { logActivity } from "@/lib/activity";
import { useCallback, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import { useI18n } from "@/i18n";

export default function ReadAloud() {
  const { t } = useI18n();
  const { videoRef, isActive, error: cameraError, startCamera, stopCamera, captureFrame } = useCamera();
  const { isSpeaking, isPaused, speak, pause, resume, stop: stopSpeech } = useSpeech();
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const [documents] = useState([]);

  const processImage = useCallback(
    async (imageSource, sourceType, title) => {
      setIsProcessing(true);
      setError(null);
      try {
        const worker = await createWorker("eng");
        const result = await worker.recognize(imageSource);
        const text = result.data.text.trim();
        await worker.terminate();

        if (text) {
          setExtractedText(text);
          logActivity({
            feature: "read-aloud",
            action: "read",
            title: title || "Document",
            summary: text.replace(/\s+/g, " ").slice(0, 120),
            details: { source: sourceType },
          });

        } else {
          setError(t("No text was detected in the image. Try a clearer image."));
        }
      } catch {
        setError(t("OCR processing failed. Please try again."));
      } finally {
        setIsProcessing(false);
      }
    },
    [t],
  );

  const handleCaptureFromCamera = async () => {
    const frame = captureFrame();
    if (frame) {
      await processImage(frame, "camera", `Camera capture ${new Date().toLocaleTimeString()}`);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("Please upload an image file."));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result ;
      await processImage(dataUrl, "upload", file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSpeak = () => {
    if (extractedText) {
      speak(extractedText, { rate: speechRate });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">{t("Read Aloud")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("Capture or upload images to extract text and have it read aloud.")}</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Camera section */}
              <Card className="border-border/60 shadow-none overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Camera Capture")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                      aria-label={t("Camera feed for text capture")}
                    />
                    {!isActive && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <Camera className="mb-3 size-12 opacity-40" aria-hidden="true" />
                        <p className="text-sm">{t("Camera is off")}</p>
                      </div>
                    )}
                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="flex items-center gap-2 rounded-full bg-primary/90 px-4 py-2 text-sm font-medium text-primary-foreground">
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />{t("Reading text…")}</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {!isActive ? (
                      <Button onClick={() => startCamera()} className="cursor-pointer gap-2" aria-label={t("Start camera")}>
                        <Camera className="size-4" />{" "}{t("Start Camera")}</Button>
                    ) : (
                      <>
                        <Button onClick={handleCaptureFromCamera} className="cursor-pointer gap-2" aria-label={t("Capture and read text")}>
                          <FileText className="size-4" />{" "}{t("Capture & Read")}</Button>
                        <Button onClick={stopCamera} variant="outline" className="cursor-pointer gap-2" aria-label={t("Stop camera")}>
                          <CameraOff className="size-4" />{" "}{t("Stop Camera")}</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Upload section */}
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Upload Image")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                    aria-label={t("Upload image file")}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer gap-2"
                    disabled={isProcessing}
                    aria-label={t("Choose image to upload")}
                  >
                    <Upload className="size-4" />{t("Choose Image")}</Button>
                </CardContent>
              </Card>

              {/* Extracted text */}
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Extracted Text")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {error && (
                    <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
                  )}
                  {cameraError && (
                    <p className="mb-3 text-sm text-destructive" role="alert">{cameraError}</p>
                  )}
                  <Textarea
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    placeholder={t("Extracted text will appear here. You can also paste or type text directly.")}
                    className="min-h-[150px] resize-y text-sm"
                    aria-label={t("Extracted text content")}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Controls sidebar */}
            <div className="space-y-4">
              {/* TTS Controls */}
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Speech Controls")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium">{t("Speed: {n0}x", { n0: speechRate.toFixed(1) })}</Label>
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
                  <div className="grid grid-cols-2 gap-2">
                    {!isSpeaking ? (
                      <Button
                        onClick={handleSpeak}
                        disabled={!extractedText}
                        className="cursor-pointer gap-1.5"
                        aria-label={t("Start reading text")}
                      >
                        <Play className="size-3.5" />{" "}{t("Read")}</Button>
                    ) : (
                      <>
                        <Button
                          onClick={isPaused ? resume : pause}
                          variant="outline"
                          className="cursor-pointer gap-1.5"
                          aria-label={isPaused ? t("Resume reading") : t("Pause reading")}
                        >
                          {isPaused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                          {isPaused ? t("Resume") : t("Pause")}
                        </Button>
                        <Button
                          onClick={stopSpeech}
                          variant="outline"
                          className="cursor-pointer gap-1.5"
                          aria-label={t("Stop reading")}
                        >
                          <Square className="size-3.5" />{" "}{t("Stop")}</Button>
                      </>
                    )}
                    <Button
                      onClick={handleSpeak}
                      disabled={!extractedText}
                      variant="outline"
                      className="cursor-pointer gap-1.5"
                      aria-label={t("Repeat reading")}
                    >
                      <RotateCcw className="size-3.5" />{" "}{t("Repeat")}</Button>
                  </div>
                  {isSpeaking && (
                    <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
                      <div className="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
                      <span className="text-xs text-primary font-medium">
                        {isPaused ? t("Paused") : t("Reading aloud…")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent documents */}
              <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("Recent Documents")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!documents ? (
                    <p className="text-sm text-muted-foreground">{t("Loading…")}</p>
                  ) : documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("No documents yet.")}</p>
                  ) : (
                    <ul className="space-y-2" role="list" aria-label={t("Recent OCR documents")}>
                      {documents.map((doc) => (
                        <li
                          key={doc._id}
                          className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {}}
                            className="shrink-0 cursor-pointer"
                            aria-label={t("Delete {title}", { title: doc.title })}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
