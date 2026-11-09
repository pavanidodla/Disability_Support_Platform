import { useCallback, useEffect, useRef, useState } from "react";

const VERSION = "0.10.14"; // keep in sync with @mediapipe/tasks-vision in package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export function useHandLandmarker() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const landmarkerRef = useRef(null);
  const initializing = useRef(false);

  const load = useCallback(async () => {
    if (landmarkerRef.current || initializing.current) return;
    initializing.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      const make = (delegate) =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        landmarkerRef.current = await make("GPU");
      } catch {
        landmarkerRef.current = await make("CPU");
      }
      setIsReady(true);
    } catch (err) {
      console.error("Failed to load hand model:", err);
      setError(err?.message || "Failed to load hand detection model");
    } finally {
      initializing.current = false;
      setIsLoading(false);
    }
  }, []);

  // Returns 21 landmarks of the first detected hand, or null
  const detect = useCallback((video, timestampMs) => {
    const lm = landmarkerRef.current;
    if (!lm || !video || video.readyState < 2) return null;
    try {
      const result = lm.detectForVideo(video, timestampMs);
      return result?.landmarks?.[0] ?? null;
    } catch (err) {
      console.error("Hand detection error:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  return { isReady, isLoading, error, load, detect };
}