import { useCallback, useEffect, useRef, useState } from "react";

const VERSION = "0.10.14"; // keep in sync with @mediapipe/tasks-vision in package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export function useHandLandmarker() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const landmarkerRef = useRef(null);
  const initializing = useRef(false);

  // Body (pose) model: loaded only when full-body signs are used
  const [poseReady, setPoseReady] = useState(false);
  const [poseLoading, setPoseLoading] = useState(false);
  const [poseError, setPoseError] = useState(null);
  const poseRef = useRef(null);
  const poseInit = useRef(false);
  const filesetRef = useRef(null);

  const load = useCallback(async () => {
    if (landmarkerRef.current || initializing.current) return;
    initializing.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      filesetRef.current = fileset;
      const make = (delegate) =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "VIDEO",
          numHands: 2,
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

  // Returns every detected hand: { landmarks: [hand1, hand2?] } (each hand = 21 landmarks)
  const detectAll = useCallback((video, timestampMs) => {
    const lm = landmarkerRef.current;
    if (!lm || !video || video.readyState < 2) return { landmarks: [] };
    try {
      const result = lm.detectForVideo(video, timestampMs);
      return { landmarks: result?.landmarks ?? [] };
    } catch (err) {
      console.error("Hand detection error:", err);
      return { landmarks: [] };
    }
  }, []);

  // Load the body (pose) model: 33 body points incl. nose, ears, shoulders, elbows, wrists
  const loadPose = useCallback(async () => {
    if (poseRef.current || poseInit.current) return;
    poseInit.current = true;
    setPoseLoading(true);
    setPoseError(null);
    try {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = filesetRef.current || (await FilesetResolver.forVisionTasks(WASM_URL));
      const make = (delegate) =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        poseRef.current = await make("GPU");
      } catch {
        poseRef.current = await make("CPU");
      }
      setPoseReady(true);
    } catch (err) {
      console.error("Failed to load body model:", err);
      setPoseError(err?.message || "Failed to load body detection model");
    } finally {
      poseInit.current = false;
      setPoseLoading(false);
    }
  }, []);

  // Returns the 33 body landmarks of the first person, or null
  const detectPose = useCallback((video, timestampMs) => {
    const pl = poseRef.current;
    if (!pl || !video || video.readyState < 2) return null;
    try {
      const result = pl.detectForVideo(video, timestampMs);
      return result?.landmarks?.[0] ?? null;
    } catch (err) {
      console.error("Body detection error:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      poseRef.current?.close?.();
      poseRef.current = null;
    };
  }, []);

  return { isReady, isLoading, error, load, detect, detectAll, poseReady, poseLoading, poseError, loadPose, detectPose };
}