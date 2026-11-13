import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCamera } from "@/hooks/use-camera";
import { useHandLandmarker } from "@/hooks/use-hand-landmarker";
import { logActivity } from "@/lib/activity";
import { SIGN_VOCABULARY, classifyGesture } from "@/lib/sign-classifier";
import {
  BODY_DIM,
  BODY_FRAME_DIM,
  FRAME_DIM,
  MAX_BODY_DISTANCE,
  MAX_DISTANCE,
  MAX_DISTANCE_2,
  MAX_MOTION_DISTANCE,
  MAX_MOTION_SAMPLES,
  MAX_PER_SIGN,
  MIN_CLIP_FRAMES,
  MOTION_DIM,
  TWO_HAND_DIM,
  classifyCustom,
  classifyMotion,
  bodyClipFeatures,
  clipFeatures,
  clipThresholds,
  deleteLocalSign,
  clearLogin,
  deleteRemoteSign,
  fetchRemoteSign,
  fetchRemoteSignsDetailed,
  fetchRemoteSummary,
  hasToken,
  loadLocalSigns,
  mergeSigns,
  partitionSigns,
  putLocalSign,
  saveRemoteBatch,
  summarize,
  toFeatures,
  twoHandFeatures,
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
const RECORD_TARGET = 80; // still sign: recording stops after this many frames
const CLIP_TARGET = 15; // moving sign: recording stops after this many takes
const MAX_CLIP_FRAMES = 150; // a moving sign longer than this (~5 s) is cut off
const CLIP_END_GAP = 12; // frames without hands that end a moving sign (~0.4 s)
const MOTION_SPEED = 0.05; // hand speed (hand-sizes per frame) above which still signs are not committed

const BODY_LINES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 7], [0, 8]];
const BODY_DOTS = [0, 7, 8, 11, 12, 13, 14, 15, 16];

function drawHands(canvas, video, hands, pose) {
  if (!canvas || !video) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;
  if (pose && pose.length > 16) {
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    BODY_LINES.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(pose[a].x * w, pose[a].y * h);
      ctx.lineTo(pose[b].x * w, pose[b].y * h);
      ctx.stroke();
    });
    ctx.fillStyle = "#3b82f6";
    BODY_DOTS.forEach((i) => {
      ctx.beginPath();
      ctx.arc(pose[i].x * w, pose[i].y * h, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (!hands || !hands.length) return;
  hands.forEach((landmarks) => {
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
  });
}

export default function SignLanguage() {
  const { t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const { videoRef, isActive, error: cameraError, startCamera, stopCamera } = useCamera();
  const {
    isReady,
    isLoading: isProcessing,
    error: modelError,
    load,
    detectAll,
    poseReady,
    poseLoading,
    poseError,
    loadPose,
    detectPose,
  } = useHandLandmarker();
  const [sentence, setSentence] = useState("");
  const [currentSign, setCurrentSign] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const canvasRef = useRef(null);
  const candidateRef = useRef({ label: "", count: 0 });
  const lastCommittedRef = useRef("");
  const noHandRef = useRef(0);
  const signCountRef = useRef(0);
  const sentenceRef = useRef("");

  // ---- Taught signs (still handshapes + moving signs) ----
  const customRef = useRef({}); // all taught signs: label -> samples
  const indexRef = useRef({ still: {}, still2: {}, moving: {}, body: {} }); // same data split by kind for matching
  const thrRef = useRef({ moving: {}, body: {} }); // learned accepted distance per moving / body sign
  const applyIndex = (signs) => {
    const index = partitionSigns(signs);
    indexRef.current = index;
    thrRef.current = {
      moving: clipThresholds(index.moving, FRAME_DIM, MAX_MOTION_DISTANCE),
      body: clipThresholds(index.body, BODY_FRAME_DIM, MAX_BODY_DISTANCE),
    };
  };
  const [customList, setCustomList] = useState([]);
  // Is each sign also saved on your account? label -> "synced" | "pending" | "error"
  const [syncMap, setSyncMap] = useState({});
  const [syncErrors, setSyncErrors] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [authExpired, setAuthExpired] = useState(false); // login rejected by the server (401)
  const [syncChecking, setSyncChecking] = useState(true); // still asking the account which signs it has
  // The 8 built-in gestures often fire by mistake once you have taught your own signs, so they are off then
  const [useBuiltin, setUseBuiltin] = useState(false);
  const builtinRef = useRef(false);
  const [stillInfo, setStillInfo] = useState(""); // closest taught signs, shown live for tuning
  // When it cannot decide, the closest sign is shown (marked "closest match"). This also shows it when nothing is close.
  const [alwaysClosest, setAlwaysClosest] = useState(false);
  const forceRef = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const infoTickRef = useRef(0);
  const setSyncState = (labels, status, error) => {
    setSyncMap((m) => ({ ...m, ...Object.fromEntries(labels.map((l) => [l, status])) }));
    setSyncErrors((e) => {
      const next = { ...e };
      labels.forEach((l) => {
        if (error) next[l] = error;
        else delete next[l];
      });
      return next;
    });
  };
  const [signName, setSignName] = useState("");
  const [recKind, setRecKind] = useState("still"); // "still" (one hand) | "still2" (two hands) | "moving" | "body"
  const [handsCount, setHandsCount] = useState(0);
  const [poseSeen, setPoseSeen] = useState(false);
  const [pushToSign, setPushToSign] = useState(false); // hold Space while signing (lets head-only signs work)
  const pushToSignRef = useRef(false);
  const spaceHeldRef = useRef(false);
  const recKindRef = useRef("still");
  const [recording, setRecording] = useState(false);
  const [recCount, setRecCount] = useState(0);
  const [noHandRec, setNoHandRec] = useState(false);
  const [recMsg, setRecMsg] = useState("");
  const recordingRef = useRef(false);
  const recNameRef = useRef("");
  const recBufferRef = useRef([]);
  const capturedRef = useRef(0);
  const frameRef = useRef(0);

  // Moving signs: hands appear -> sign -> hands leave = one clip
  const clipRef = useRef([]);
  const clipGapRef = useRef(0);
  const [clipActive, setClipActive] = useState(false);
  const [motionInfo, setMotionInfo] = useState("");
  const prevWristRef = useRef(null);
  const speedRef = useRef(0);

  useEffect(() => {
    sentenceRef.current = sentence;
  }, [sentence]);

  useEffect(() => {
    builtinRef.current = useBuiltin;
  }, [useBuiltin]);

  useEffect(() => {
    forceRef.current = alwaysClosest;
  }, [alwaysClosest]);

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
    clipRef.current = [];
    clipGapRef.current = 0;
    setClipActive(false);

    const label = recNameRef.current;
    const kind = recKindRef.current;
    const buf = recBufferRef.current;
    const taken = capturedRef.current;
    recBufferRef.current = [];
    if (!label || buf.length === 0) {
      setRecMsg(
        kind === "moving" || kind === "body"
          ? tRef.current("No complete take was recorded, so nothing was saved.")
          : tRef.current("No hand was seen, so nothing was saved."),
      );
      return;
    }

    const cur = customRef.current;
    const dim = kind === "body" ? BODY_DIM : kind === "moving" ? MOTION_DIM : kind === "still2" ? TWO_HAND_DIM : 63;
    const existing = cur[label];
    const base = existing && existing.length && existing[0].length === dim ? existing : []; // a new kind replaces the old one
    const cap = kind === "moving" || kind === "body" ? MAX_MOTION_SAMPLES : MAX_PER_SIGN;
    cur[label] = [...base, ...buf].slice(-cap);
    applyIndex(cur);
    setCustomList(summarize(cur));
    candidateRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";

    const unit = kind === "moving" || kind === "body" ? tRef.current("takes") : tRef.current("samples");
    const samples = cur[label];
    setSyncState([label], "pending");
    (async () => {
      // 1) this device (IndexedDB, plenty of room)
      const okLocal = await putLocalSign(label, samples);
      setRecMsg(
        okLocal
          ? tRef.current("Saved {n} {unit} for {label}. Show the sign to test it.", { n: taken, unit, label })
          : tRef.current("Could not save to this browser (storage is blocked)."),
      );
      // 2) your account
      const r = await saveRemoteBatch([[label, samples]]);
      if (r.authExpired) setAuthExpired(true);
      if (r.saved.includes(label)) {
        setSyncState([label], "synced");
        setRecMsg(tRef.current("Saved {n} {unit} for {label} to your account. Show the sign to test it.", { n: taken, unit, label }));
      } else if (r.signedOut) {
        setSyncState([label], "error", "Not signed in");
        setRecMsg(tRef.current("Saved on this device only. Sign in to keep your signs permanently."));
      } else {
        const error = r.failed[0]?.error || "Unknown error";
        setSyncState([label], "error", error);
        setRecMsg(
          tRef.current("Saved on this device, but NOT on your account: {error}. Press Sync to account to retry.", { error }),
        );
      }
    })();
  }, []);

  // Upload the given signs to the account, update their sync status, return how many were saved
  const uploadSigns = useCallback(async (labels) => {
    const entries = labels.filter((l) => customRef.current[l]).map((l) => [l, customRef.current[l]]);
    if (!entries.length) return 0;
    setSyncState(labels, "pending");
    const r = await saveRemoteBatch(entries, ({ done, total }) =>
      setSyncMsg(tRef.current("Uploading… {done} of {total} signs", { done, total })),
    );
    if (r.authExpired) setAuthExpired(true);
    setSyncState(r.saved, "synced");
    r.failed.forEach((f) => setSyncState([f.label], "error", f.error));
    return r.saved.length;
  }, []);

  // On page open: load this device's signs, then check them against the account
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      applyIndex(customRef.current);
      setCustomList(summarize(customRef.current));
    };
    (async () => {
      const local = await loadLocalSigns();
      if (cancelled) return;
      // keep anything recorded while loading
      const start = { ...local, ...customRef.current };
      customRef.current = start;
      refresh();

      // 1) Quick check (a few bytes): which signs does the account have, and how many samples each?
      const sum = await fetchRemoteSummary();
      if (cancelled) return;

      if (sum.counts) {
        const remote = sum.counts;
        const same = [];
        const upload = [];
        const download = [];
        Object.keys(start).forEach((label) => {
          const n = start[label].length;
          if (remote[label] === undefined || n > remote[label]) upload.push(label);
          else if (n < remote[label]) download.push(label);
          else same.push(label);
        });
        Object.keys(remote).forEach((label) => {
          if (!start[label]) download.push(label);
        });
        setSyncState(same, "synced"); // identical on this device and on the account: nothing to transfer
        setSyncChecking(false);

        for (const label of download) {
          const samples = await fetchRemoteSign(label);
          if (cancelled) return;
          if (samples) {
            customRef.current[label] = samples;
            putLocalSign(label, samples);
            setSyncState([label], "synced");
          } else {
            setSyncState([label], "error", "Could not download this sign from your account");
          }
        }
        if (download.length) refresh();

        if (upload.length) {
          const n = await uploadSigns(upload);
          if (!cancelled && n < upload.length) {
            setSyncMsg(tRef.current("{n} signs could not be uploaded. Press Sync to account to retry.", { n: upload.length - n }));
          }
        }
        return;
      }

      if (!sum.missing) {
        // signed out, expired login, or server problem: say why
        if (sum.authExpired) setAuthExpired(true);
        setSyncChecking(false);
        setSyncState(Object.keys(start), "error", sum.error);
        setSyncMsg(
          sum.authExpired
            ? tRef.current("Your login expired. Sign in again to save signs to your account.")
            : tRef.current("Could not check your account: {error}", { error: sum.error }),
        );
        return;
      }

      // Older backend without the quick-check route: download everything (slower)
      const fetched = await fetchRemoteSignsDetailed();
      if (cancelled) return;
      setSyncChecking(false);
      if (!fetched.signs) {
        if (fetched.authExpired) setAuthExpired(true);
        setSyncState(Object.keys(start), "error", fetched.error);
        setSyncMsg(tRef.current("Could not load your account's signs: {error}", { error: fetched.error }));
        return;
      }
      const { merged, toUpload } = mergeSigns(customRef.current, fetched.signs);
      customRef.current = merged;
      refresh();
      Object.keys(fetched.signs).forEach((label) => {
        if (!start[label] || start[label].length !== merged[label].length) putLocalSign(label, merged[label]);
      });
      setSyncState(Object.keys(fetched.signs).filter((l) => !toUpload.includes(l)), "synced");
      if (toUpload.length) {
        const n = await uploadSigns(toUpload);
        if (!cancelled && n < toUpload.length) {
          setSyncMsg(tRef.current("{n} signs could not be uploaded. Press Sync to account to retry.", { n: toUpload.length - n }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uploadSigns]);

  const syncAll = async () => {
    const labels = Object.keys(customRef.current).filter((l) => syncMap[l] !== "synced");
    if (!labels.length) {
      setSyncMsg(t("All signs are already on your account."));
      return;
    }
    if (!hasToken()) {
      setSyncMsg(t("Not signed in: sign in to save signs to your account."));
      return;
    }
    setSyncing(true);
    setSyncMsg(t("Uploading {n} signs…", { n: labels.length }));
    const n = await uploadSigns(labels);
    setSyncing(false);
    setSyncMsg(
      n === labels.length
        ? t("Done: {n} signs uploaded to your account.", { n })
        : t("{ok} of {total} uploaded. See the errors below.", { ok: n, total: labels.length }),
    );
  };

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

  // Load the body model only when full-body signs are used
  useEffect(() => {
    if (recKind === "body" || customList.some((c) => c.kind === "body")) loadPose();
  }, [recKind, customList, loadPose]);

  // Hold Space while signing: the sign lasts exactly as long as Space is held
  useEffect(() => {
    pushToSignRef.current = pushToSign;
    if (!pushToSign) {
      spaceHeldRef.current = false;
      return;
    }
    const typing = (el) =>
      !!el &&
      (el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        (el.tagName === "INPUT" && !["checkbox", "radio", "button"].includes(el.type)));
    const down = (e) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
    };
    const up = (e) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      spaceHeldRef.current = false;
    };
  }, [pushToSign]);

  // A clip has ended (hands left the view, or Space was released): record it or recognise it.
  // Each clip frame is { hands, pose }.
  const endClip = useCallback(
    (aspect) => {
      const frames = clipRef.current;
      clipRef.current = [];
      clipGapRef.current = 0;
      setClipActive(false);
      if (frames.length < MIN_CLIP_FRAMES) {
        if (!recordingRef.current) {
          setMotionInfo(tRef.current("Too short ({n} frames), ignored. Keep your hands in view while signing.", { n: frames.length }));
        }
        return;
      }
      const handsOnly = frames.map((f) => f.hands);

      // Recording a moving sign or a full-body sign
      if (recordingRef.current && (recKindRef.current === "moving" || recKindRef.current === "body")) {
        const body = recKindRef.current === "body";
        const original = body ? bodyClipFeatures(frames, aspect, false) : clipFeatures(handsOnly, aspect, false);
        const mirrored = body ? bodyClipFeatures(frames, aspect, true) : clipFeatures(handsOnly, aspect, true); // also works mirrored
        if (!original || !mirrored) {
          setRecMsg(
            body
              ? tRef.current("Take not saved: your head and shoulders were not seen well enough. Step back a little.")
              : tRef.current("Take not saved: no hands were seen."),
          );
          return;
        }
        setRecMsg("");
        recBufferRef.current.push(original, mirrored);
        capturedRef.current += 1;
        setRecCount(capturedRef.current);
        if (capturedRef.current >= CLIP_TARGET) finishRecording();
        return;
      }

      // Recognising: try moving (hands) signs and full-body signs, keep the better match
      const results = [];
      if (Object.keys(indexRef.current.moving).length) {
        const f = clipFeatures(handsOnly, aspect, false);
        if (f) {
          results.push(classifyMotion(indexRef.current.moving, f, FRAME_DIM, MAX_MOTION_DISTANCE, thrRef.current.moving, forceRef.current));
        }
      }
      if (Object.keys(indexRef.current.body).length) {
        const f = bodyClipFeatures(frames, aspect, false);
        if (f) {
          results.push(
            classifyMotion(indexRef.current.body, f, BODY_FRAME_DIM, MAX_BODY_DISTANCE, thrRef.current.body, forceRef.current),
          );
        }
      }
      candidateRef.current = { label: "", count: 0 };
      lastCommittedRef.current = "";

      const accepted = results
        .filter((r) => r.label !== "UNKNOWN")
        .sort((x, y) => x.distance / x.limit - y.distance / y.limit)[0];
      if (accepted) {
        setUncertain(!!accepted.uncertain);
        setCurrentSign(accepted.label);
        setConfidence(Math.round(accepted.confidence * 100) / 100);
        setSentence((prev) => (prev ? `${prev} ${accepted.label}` : accepted.label));
        signCountRef.current += 1;
        setMotionInfo(
          tRef.current("Moving sign: {label} (distance {d}, accepted up to {max})", {
            label: accepted.label,
            d: accepted.distance.toFixed(2),
            max: accepted.limit.toFixed(2),
          }),
        );
      } else {
        setCurrentSign(null);
        const guesses = results
          .flatMap((r) => r.guesses)
          .sort((x, y) => x.distance / x.limit - y.distance / y.limit)
          .slice(0, 3);
        setMotionInfo(
          results.length
            ? tRef.current("Moving sign not recognised ({n} frames). Closest: {list}", {
                n: frames.length,
                list: guesses.map((g) => `${g.label} ${g.distance.toFixed(2)} (limit ${g.limit.toFixed(2)})`).join(", ") || "-",
              })
            : tRef.current("Moving sign not recognised: the body was not seen well enough."),
        );
      }
    },
    [finishRecording],
  );

  // One camera frame. `hands` = every detected hand (0, 1 or 2), each with 21 landmarks.
  const handleFrame = useCallback(
    (hands, pose) => {
      const rec = recordingRef.current;
      const kind = recKindRef.current;
      const video = videoRef.current;
      const aspect = video && video.videoHeight ? video.videoWidth / video.videoHeight : 1;
      const hasBodySigns = Object.keys(indexRef.current.body).length > 0;
      const hasMotionSigns = Object.keys(indexRef.current.moving).length > 0 || hasBodySigns;
      const hasTwoHandSigns = Object.keys(indexRef.current.still2).length > 0;
      setHandsCount(hands.length);
      setPoseSeen(!!pose);
      const isClipKind = kind === "moving" || kind === "body";
      const clipMode = (rec && isClipKind) || (!rec && hasMotionSigns);
      // Space-controlled signing: the sign lasts exactly as long as Space is held
      const keyMode = pushToSignRef.current && ((rec && isClipKind) || (!rec && hasMotionSigns));

      // Cut the stream into clips: hands visible = signing (or Space held in key mode)
      if (clipMode) {
        const active = keyMode ? spaceHeldRef.current : hands.length > 0;
        if (active) {
          clipGapRef.current = 0;
          if (clipRef.current.length === 0) setClipActive(true);
          clipRef.current.push({ hands, pose });
          if (clipRef.current.length >= MAX_CLIP_FRAMES) endClip(aspect);
        } else if (clipRef.current.length) {
          clipGapRef.current += 1;
          if (clipGapRef.current >= (keyMode ? 1 : CLIP_END_GAP)) endClip(aspect);
        }
      } else if (clipRef.current.length) {
        clipRef.current = [];
        setClipActive(false);
      }

      // Recording a moving or full-body sign: nothing else to do per frame
      if (rec && isClipKind) {
        setNoHandRec(kind === "body" ? !pose : hands.length === 0 && clipRef.current.length === 0);
        setCurrentSign(null);
        return;
      }

      const landmarks = hands[0] ?? null;

      if (!landmarks) {
        if (rec) setNoHandRec(true);
        prevWristRef.current = null;
        speedRef.current = 0;
        noHandRef.current += 1;
        candidateRef.current = { label: "", count: 0 };
        if (noHandRef.current > NO_HAND_RESET_FRAMES) {
          lastCommittedRef.current = "";
          setCurrentSign(null);
          setStillInfo("");
        }
        return;
      }
      noHandRef.current = 0;

      // How fast is the hand moving? (in hand sizes per frame)
      const wrist = landmarks[0];
      const handSize = Math.hypot((landmarks[9].x - wrist.x) * aspect, landmarks[9].y - wrist.y) || 1e-3;
      const prev = prevWristRef.current;
      if (prev) {
        const sp = Math.hypot((wrist.x - prev.x) * aspect, wrist.y - prev.y) / handSize;
        speedRef.current = 0.6 * speedRef.current + 0.4 * sp;
      }
      prevWristRef.current = { x: wrist.x, y: wrist.y };

      // Recording a still sign (one hand, or two hands): save the shape plus a mirrored copy
      if (rec) {
        const two = kind === "still2";
        const enough = !two || hands.length >= 2; // a two-hand sign needs both hands in view
        setNoHandRec(!enough);
        setCurrentSign(null);
        if (!enough) return;
        frameRef.current += 1;
        if (frameRef.current % 2 === 0) {
          if (two) {
            recBufferRef.current.push(twoHandFeatures(hands, aspect, false));
            recBufferRef.current.push(twoHandFeatures(hands, aspect, true));
          } else {
            recBufferRef.current.push(toFeatures(landmarks, aspect, false));
            recBufferRef.current.push(toFeatures(landmarks, aspect, true));
          }
          capturedRef.current += 1;
          setRecCount(capturedRef.current);
          if (capturedRef.current >= RECORD_TARGET) finishRecording();
        }
        return;
      }

      const fast = speedRef.current > MOTION_SPEED;
      let gesture = { label: "UNKNOWN", confidence: 0 };
      let isCustom = false;
      // show the closest taught signs a few times per second (helps to see why a sign was missed or confused)
      const showGuesses = (g) => {
        infoTickRef.current += 1;
        if (infoTickRef.current % 6 === 0 && g.guesses && g.guesses.length) {
          setStillInfo(g.guesses.map((x) => `${x.label} ${x.distance.toFixed(2)}`).join(", "));
        }
      };

      if (hands.length >= 2 && hasTwoHandSigns) {
        // Both hands in view: match taught two-hand signs (not while the hands are moving fast)
        if (!(hasMotionSigns && fast)) {
          gesture = classifyCustom(indexRef.current.still2, twoHandFeatures(hands, aspect, false), MAX_DISTANCE_2, forceRef.current);
          showGuesses(gesture);
          isCustom = gesture.label !== "UNKNOWN";
        }
      } else {
        // While moving signs exist, two hands or a fast-moving hand mean "moving sign in progress":
        // do not commit a still sign from a frame in the middle of the movement
        if (hasMotionSigns && (hands.length >= 2 || fast)) {
          candidateRef.current = { label: "", count: 0 };
          return;
        }
        // One hand: taught signs first, then (only if allowed) the built-in gestures
        const taughtCount = Object.keys(indexRef.current.still).length + Object.keys(indexRef.current.still2).length;
        if (Object.keys(indexRef.current.still).length) {
          gesture = classifyCustom(indexRef.current.still, toFeatures(landmarks, aspect, false), MAX_DISTANCE, forceRef.current);
          showGuesses(gesture);
          isCustom = gesture.label !== "UNKNOWN";
        }
        if (!isCustom && (builtinRef.current || taughtCount === 0)) gesture = classifyGesture(landmarks);
      }

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
      setUncertain(!!gesture.uncertain);
      setConfidence(Math.round(gesture.confidence * 100) / 100);

      // Stability check: accept a sign only after it is held for several frames
      const cand = candidateRef.current;
      candidateRef.current =
        cand.label === key ? { label: key, count: cand.count + 1 } : { label: key, count: 1 };

      if (candidateRef.current.count >= STABLE_FRAMES && lastCommittedRef.current !== key) {
        lastCommittedRef.current = key;
        setSentence((prevText) => (prevText ? `${prevText} ${text}` : text));
        signCountRef.current += 1;
      }
    },
    [endClip, finishRecording, videoRef],
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
        const ts = performance.now();
        const res = detectAll(video, ts);
        const needPose =
          (recordingRef.current && recKindRef.current === "body") || Object.keys(indexRef.current.body).length > 0;
        const pose = needPose ? detectPose(video, ts) : null;
        drawHands(canvasRef.current, video, res.landmarks, pose);
        handleFrame(res.landmarks, pose);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isActive, isReady, poseReady, detectAll, detectPose, videoRef, handleFrame]);

  const handleStart = async () => {
    candidateRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";
    noHandRef.current = 0;
    clipRef.current = [];
    await startCamera();
  };

  const handleStop = () => {
    finishRecording();
    flushSigns();
    stopCamera();
    setCurrentSign(null);
    clipRef.current = [];
    setClipActive(false);
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
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
    recKindRef.current = recKind;
    recBufferRef.current = [];
    capturedRef.current = 0;
    frameRef.current = 0;
    clipRef.current = [];
    clipGapRef.current = 0;
    setClipActive(false);
    setRecCount(0);
    setRecMsg(
      recKind === "moving"
        ? pushToSign
          ? t("Recording: hold Space while you do the sign, release it when done. Repeat for each take.")
          : t("Recording: raise your hands, do the sign, then lower your hands out of view. Repeat for each take.")
        : recKind === "body"
          ? pushToSign
            ? t("Recording: hold Space while you do the sign, release it when done. Repeat for each take.")
            : t("Recording: stand so your head and shoulders are in view, raise your hands, do the sign, then lower your hands. Repeat for each take.")
          : "",
    );
    setCurrentSign(null);
    recordingRef.current = true;
    setRecording(true);
  };

  const removeSign = (label) => {
    delete customRef.current[label];
    applyIndex(customRef.current);
    deleteLocalSign(label);
    deleteRemoteSign(label);
    setSyncMap((m) => {
      const next = { ...m };
      delete next[label];
      return next;
    });
    setCustomList(summarize(customRef.current));
    candidateRef.current = { label: "", count: 0 };
    lastCommittedRef.current = "";
  };

  const recTarget = recKind === "moving" || recKind === "body" ? CLIP_TARGET : RECORD_TARGET;
  const bodyUi = recKind === "body" || customList.some((c) => c.kind === "body");
  const clipUi = bodyUi || recKind === "moving" || customList.some((c) => c.kind === "moving");

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
                  {isActive && (
                    <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
                      <div className="rounded-full bg-black/70 px-3 py-1 text-xs text-white" role="status">
                        {t("Hands detected: {n}", { n: handsCount })}
                      </div>
                      {bodyUi && (
                        <div className="rounded-full bg-black/70 px-3 py-1 text-xs text-white" role="status">
                          {poseReady
                            ? poseSeen
                              ? t("Body: seen")
                              : t("Body: not seen, step back")
                            : poseLoading
                              ? t("Loading body detection…")
                              : t("Body model not loaded")}
                        </div>
                      )}
                      {clipActive && (
                        <div className="rounded-full bg-black/70 px-3 py-1 text-xs text-white" role="status">
                          {t("Signing… lower your hands when the sign is done")}
                        </div>
                      )}
                    </div>
                  )}
                  {isActive && recording && (
                    <div className="absolute right-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs text-white" role="status">
                      {noHandRec
                        ? recKind === "body"
                          ? t("● REC: show your head and shoulders")
                          : recKind === "still2"
                            ? t("● REC: show both hands")
                            : t("● REC: no hand detected")
                        : `● REC ${recNameRef.current} · ${recCount}/${recTarget}`}
                    </div>
                  )}
                  {isActive && !recording && currentSign && (
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl bg-black/70 px-5 py-3 text-white backdrop-blur-sm">
                      <div>
                        <p className="text-xs opacity-70">{t("Detected Sign")}</p>
                        <p className="text-xl font-bold tracking-wide">{currentSign}</p>
                        {uncertain && <p className="text-xs opacity-70">{t("Closest match (not sure)")}</p>}
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
              {poseError && (
                <p className="text-sm text-destructive" role="alert">
                  {poseError}{" "}
                  <button type="button" onClick={loadPose} className="underline cursor-pointer">{t("Retry")}</button>
                </p>
              )}
              {stillInfo && !recording && handsCount > 0 && (
                <p className="text-xs text-muted-foreground" role="status">
                  {t("Closest signs (smaller = closer, accepted up to about {max}): {list}", { max: MAX_DISTANCE, list: stillInfo })}
                </p>
              )}
              {motionInfo && !recording && (
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite">{motionInfo}</p>
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
                <Button onClick={handleCopy} variant="outline" disabled={!sentence} className="cursor-pointer gap-2" aria-label={t("Copy sentence")}>
                  <Copy className="size-4" />{" "}{t("Copy")}</Button>
                <Button onClick={handleClear} variant="outline" disabled={!sentence} className="cursor-pointer gap-2" aria-label={t("Clear sentence")}>
                  <Eraser className="size-4" />{" "}{t("Clear")}</Button>
              </div>
              {!sentence && (
                <p className="text-xs text-muted-foreground">
                  {t("Copy and Clear turn on after the first sign is detected and appears under Recognized Sentence.")}
                </p>
              )}
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
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("Sign type")}>
                    <Button
                      size="sm"
                      variant={recKind === "still" ? "default" : "outline"}
                      aria-pressed={recKind === "still"}
                      disabled={recording}
                      onClick={() => setRecKind("still")}
                      className="cursor-pointer"
                    >
                      {t("One hand")}
                    </Button>
                    <Button
                      size="sm"
                      variant={recKind === "still2" ? "default" : "outline"}
                      aria-pressed={recKind === "still2"}
                      disabled={recording}
                      onClick={() => setRecKind("still2")}
                      className="cursor-pointer"
                    >
                      {t("Two hands")}
                    </Button>
                    <Button
                      size="sm"
                      variant={recKind === "body" ? "default" : "outline"}
                      aria-pressed={recKind === "body"}
                      disabled={recording}
                      onClick={() => setRecKind("body")}
                      className="cursor-pointer"
                    >
                      {t("Full body")}
                    </Button>
                    <Button
                      size="sm"
                      variant={recKind === "moving" ? "default" : "outline"}
                      aria-pressed={recKind === "moving"}
                      disabled={recording}
                      onClick={() => setRecKind("moving")}
                      className="cursor-pointer"
                    >
                      {t("Moving sign")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {recKind === "body"
                      ? t("Full-body sign (head, body, arms and both hands moving): stand back so your head and shoulders are in view. Press Record, raise your hands, do the whole sign, then lower your hands. That is one take. Do 10 to 15 takes the same way. For head-only signs (nod, shake) turn on Hold Space below.")
                      : recKind === "moving"
                      ? t("Moving sign (one or both hands, with movement): press Record, raise your hands, do the sign, then lower your hands out of view. That is one take. Do about 10 to 15 takes, then press Stop. Do the sign the same way each time.")
                      : recKind === "still2"
                        ? t("Two-hand sign (held still): show BOTH hands, press Record and hold the sign. Tilt and move your hands a little. Keep the hands apart so the camera can see both. It stops by itself and is detected right away.")
                        : t("One-hand sign (held still): press Record and hold the sign in view. Slowly tilt and move your hand a little. It stops by itself and is detected right away.")}
                  </p>
                  {customList.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={alwaysClosest} onChange={(e) => setAlwaysClosest(e.target.checked)} />
                      {t("Always show the closest match, even when nothing is close (may show wrong signs)")}
                    </label>
                  )}
                  {customList.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={useBuiltin} onChange={(e) => setUseBuiltin(e.target.checked)} />
                      {t("Also use the 8 built-in basic gestures (they can cause wrong detections)")}
                    </label>
                  )}
                  {clipUi && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={pushToSign}
                        disabled={recording}
                        onChange={(e) => setPushToSign(e.target.checked)}
                      />
                      {t("Hold Space while signing instead of lowering your hands (use the same way for training and detecting)")}
                    </label>
                  )}
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
                    <div className="space-y-2 rounded-md border border-border/60 p-2 text-xs">
                      {authExpired && (
                        <div className="space-y-2 rounded-md border border-destructive/50 p-2">
                          <p className="text-destructive" role="alert">
                            {t("Your login expired, so signs cannot be saved to your account. Your signs are safe on this device.")}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => {
                              clearLogin();
                              window.location.href = "/auth";
                            }}
                            className="cursor-pointer"
                          >
                            {t("Sign in again")}
                          </Button>
                        </div>
                      )}
                      <p role="status" aria-live="polite">
                        {syncChecking
                          ? t("Checking your account…")
                          : t("{ok} of {total} signs are saved on your account", {
                              ok: customList.filter((c) => syncMap[c.label] === "synced").length,
                              total: customList.length,
                            })}
                      </p>
                      {!syncChecking && customList.some((c) => syncMap[c.label] !== "synced") && (
                        <Button size="sm" variant="outline" onClick={syncAll} disabled={syncing} className="cursor-pointer gap-2">
                          {syncing && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                          {t("Sync to account")}
                        </Button>
                      )}
                      {syncMsg && <p className="text-muted-foreground" role="status" aria-live="polite">{syncMsg}</p>}
                      {Object.entries(syncErrors).slice(0, 4).map(([label, error]) => (
                        <p key={label} className="text-destructive" role="alert">{label}: {error}</p>
                      ))}
                    </div>
                  )}
                  {customList.length > 0 && (
                    <ul className="space-y-1.5 pt-1" role="list" aria-label={t("Your taught signs")}>
                      {customList.map(({ label, count, kind }) => (
                        <li key={label} className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {label}{" "}
                            <span
                              title={syncMap[label] === "synced" ? t("Saved on your account") : t("Not on your account yet")}
                              aria-label={syncMap[label] === "synced" ? t("Saved on your account") : t("Not on your account yet")}
                            >
                              {syncChecking ? "…" : syncMap[label] === "synced" ? "✓" : "⚠"}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            {kind === "body" ? t("full body") : kind === "moving" ? t("moving") : kind === "still2" ? t("two hands") : t("one hand")} · {count}
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