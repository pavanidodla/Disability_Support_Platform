import { useCallback, useEffect, useRef, useState } from "react";

// COCO-SSD: a real object detector (80 common classes, returns bounding boxes).
export function useObjectDetection() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const modelRef = useRef(null);
  const isInitializing = useRef(false);

  const loadModel = useCallback(async () => {
    if (modelRef.current || isInitializing.current) return;
    isInitializing.current = true;
    setIsLoading(true);
    setLoadError(null);

    try {
      const tf = await import("@tensorflow/tfjs");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");

      try {
        await tf.setBackend("webgl");
      } catch {
        await tf.setBackend("cpu");
      }
      await tf.ready();

      modelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      setIsModelLoaded(true);
      console.log("✓ COCO-SSD model loaded (TensorFlow.js)");
    } catch (err) {
      console.error("Failed to load object detection model:", err);
      setLoadError(err?.message || "Failed to load model");
    } finally {
      isInitializing.current = false;
      setIsLoading(false);
    }
  }, []);

  // Detect objects in a video element. Returns [{ label, confidence, bbox: {x,y,w,h} }]
  const detect = useCallback(async (video) => {
    if (!modelRef.current || !video || video.readyState < 2 || !video.videoWidth) {
      return [];
    }
    try {
      // maxNumBoxes = 20, minScore = 0.2 (the page applies the user's threshold)
      const predictions = await modelRef.current.detect(video, 20, 0.2);
      return predictions.map((p) => ({
        label: formatLabel(p.class),
        confidence: Math.round(p.score * 100) / 100,
        bbox: { x: p.bbox[0], y: p.bbox[1], w: p.bbox[2], h: p.bbox[3] },
      }));
    } catch (err) {
      console.error("Detection error:", err);
      return [];
    }
  }, []);

  useEffect(() => {
    return () => {
      modelRef.current?.dispose?.();
      modelRef.current = null;
    };
  }, []);

  return { isModelLoaded, isLoading, loadError, loadModel, detect };
}

function formatLabel(label) {
  const clean = label.replace(/,/g, "").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}