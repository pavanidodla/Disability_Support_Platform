// Taught (user-recorded) signs: feature extraction, storage and a small kNN classifier.
// Put this file at: frontend/src/lib/custom-signs.js

const STORAGE_KEY = "accessai.customSigns.v1";
const API_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000";

export const MAX_PER_SIGN = 400; // stored samples per sign (originals + mirrored)
export const K = 5;
// Tuning: a taught sign is accepted only when the closest stored sample is nearer than this.
// Lower = stricter (fewer false detections), higher = more forgiving.
export const MAX_DISTANCE = 0.75;

// 63 numbers: 21 landmarks translated to the wrist, scaled by hand size.
// `aspect` = videoWidth / videoHeight (MediaPipe x and y are normalised separately).
// `mirror` flips the hand so a sign recorded with one hand also works with the other.
export function toFeatures(lm, aspect = 1, mirror = false) {
  const sx = mirror ? -aspect : aspect;
  const w = lm[0];
  const pts = lm.map((p) => [(p.x - w.x) * sx, p.y - w.y, (p.z - w.z) * aspect]);
  const scale = Math.hypot(pts[9][0], pts[9][1]) || 1; // wrist -> middle knuckle
  const out = new Array(63);
  for (let i = 0; i < 21; i++) {
    out[i * 3] = Math.round((pts[i][0] / scale) * 1e4) / 1e4;
    out[i * 3 + 1] = Math.round((pts[i][1] / scale) * 1e4) / 1e4;
    out[i * 3 + 2] = Math.round((pts[i][2] / scale) * 1e4) / 1e4;
  }
  return out;
}

// ---- Two-hand still signs: both hands' shapes + where the hands are relative to each other ----
export const TWO_HAND_DIM = 63 * 2 + 2; // 128
export const MAX_DISTANCE_2 = 1.1; // like MAX_DISTANCE, for two hands
const OFFSET_WEIGHT = 0.5; // how much the distance between the hands counts

// hands: array of 2+ hands (21 landmarks each). The left-most hand (in the image) comes first,
// so the mirrored copy also matches when the hands are swapped.
export function twoHandFeatures(hands, aspect = 1, mirror = false) {
  if (!hands || hands.length < 2) return null;
  const sx = mirror ? -aspect : aspect;
  const info = hands
    .slice(0, 2)
    .map((lm) => ({
      lm,
      wx: lm[0].x * sx,
      wy: lm[0].y,
      size: Math.hypot((lm[9].x - lm[0].x) * aspect, lm[9].y - lm[0].y) || 1e-3,
    }))
    .sort((a, b) => a.wx - b.wx);
  const mean = (info[0].size + info[1].size) / 2;
  const off = [
    Math.round(((info[1].wx - info[0].wx) / mean) * OFFSET_WEIGHT * 1e4) / 1e4,
    Math.round(((info[1].wy - info[0].wy) / mean) * OFFSET_WEIGHT * 1e4) / 1e4,
  ];
  return [...toFeatures(info[0].lm, aspect, mirror), ...toFeatures(info[1].lm, aspect, mirror), ...off];
}

export function loadCustomSigns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export function saveCustomSigns(signs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signs));
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

export function summarize(signs) {
  return Object.entries(signs)
    .map(([label, arr]) => ({
      label,
      count: Math.floor(arr.length / 2), // /2: originals + mirrored
      kind:
        arr[0] && arr[0].length === BODY_DIM
          ? "body"
          : arr[0] && arr[0].length === MOTION_DIM
            ? "moving"
            : arr[0] && arr[0].length === TWO_HAND_DIM
              ? "still2"
              : "still",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Split stored signs into one-hand stills (63 numbers), two-hand stills (128) and moving clips (MOTION_DIM).
export function partitionSigns(signs) {
  const still = {};
  const still2 = {};
  const moving = {};
  const body = {};
  for (const [label, arr] of Object.entries(signs)) {
    if (!arr || !arr.length) continue;
    const len = arr[0].length;
    (len === BODY_DIM ? body : len === MOTION_DIM ? moving : len === TWO_HAND_DIM ? still2 : still)[label] = arr;
  }
  return { still, still2, moving, body };
}

// Class-balanced nearest-neighbour. Each taught sign is scored by the average distance to ITS OWN
// closest samples, so a sign you recorded many times cannot outvote a similar sign with fewer samples.
// Returns { label, confidence, distance, guesses } (`guesses` = the three closest signs, for display).
export const K_CLASS = 3; // closest samples per sign that are averaged
export const AMBIGUITY = 1.08; // the runner-up must be at least 8% farther than the best, else "unknown"
// When two signs are almost equally close, the closest one is returned with `uncertain: true` (not "unknown").
// With forceClosest, the closest sign is returned even when it is farther than maxDistance.
export function classifyCustom(signs, feat, maxDistance = MAX_DISTANCE, forceClosest = false) {
  const n = feat.length;
  const per = [];
  for (const [label, arr] of Object.entries(signs)) {
    const best = []; // the K_CLASS smallest squared distances, ascending
    for (const s of arr) {
      let d = 0;
      for (let i = 0; i < n; i++) {
        const diff = s[i] - feat[i];
        d += diff * diff;
      }
      if (best.length < K_CLASS || d < best[best.length - 1]) {
        let j = best.length;
        while (j > 0 && best[j - 1] > d) j--;
        best.splice(j, 0, d);
        if (best.length > K_CLASS) best.pop();
      }
    }
    if (!best.length) continue;
    const score = Math.sqrt(best.reduce((a, v) => a + v, 0) / best.length);
    per.push({ label, nearest: Math.sqrt(best[0]), score });
  }
  if (!per.length) return { label: "UNKNOWN", confidence: 0, distance: Infinity, guesses: [] };
  per.sort((a, b) => a.score - b.score);
  const guesses = per.slice(0, 3).map((x) => ({ label: x.label, distance: x.score }));
  const top = per[0];
  if (top.nearest > maxDistance || top.score > maxDistance * 1.3) {
    if (forceClosest) return { label: top.label, confidence: 0.52, distance: top.score, guesses, uncertain: true };
    return { label: "UNKNOWN", confidence: 0, distance: top.score, guesses };
  }
  if (per.length > 1 && per[1].score < top.score * AMBIGUITY) {
    // two signs almost equally close: show the closest one, marked as a guess
    return { label: top.label, confidence: 0.55, distance: top.score, guesses, uncertain: true };
  }
  const closeness = 1 - top.score / (maxDistance * 1.4); // 1 = identical, ~0.28 at the limit
  return { label: top.label, confidence: Math.min(0.99, 0.5 + closeness), distance: top.score, guesses };
}

// ---------------- Moving signs: both hands + movement over time ----------------
// A moving sign is recorded as a short clip (hands appear -> sign -> hands leave).
// The clip is resampled to MOTION_FRAMES frames. Each frame holds, for up to two hands
// (left-most hand first): the hand shape (21 points relative to the wrist, scaled by hand size)
// and the wrist position relative to the clip's centre. Clips are compared with DTW, which
// tolerates signing a bit faster or slower.
export const MOTION_FRAMES = 16;
const SHAPE_DIM = 42; // 21 points x (x, y)
export const FRAME_DIM = SHAPE_DIM * 2 + 4; // two shapes + two wrist positions = 88
export const MOTION_DIM = MOTION_FRAMES * FRAME_DIM; // 1408
export const MIN_CLIP_FRAMES = 8;
export const MAX_MOTION_SAMPLES = 120; // stored clips per sign (originals + mirrored)
// Tuning: a moving sign is accepted when its DTW distance to a taught clip is below this.
// Lower = stricter. The page shows the distance of every clip so you can tune it.
export const MAX_MOTION_DISTANCE = 0.4; // used until a sign has 3+ takes; then the limit is learned per sign
const POS_WEIGHT = 3; // how much the movement path counts compared with the finger shapes
const BAND = 4; // DTW may shift timing by at most this many frames

const r3 = (v) => Math.round(v * 1e3) / 1e3;

function handView(lm, aspect, mirror) {
  const sx = mirror ? -aspect : aspect;
  const pts = lm.map((p) => [p.x * sx, p.y]);
  const w = pts[0];
  const scale = Math.hypot(pts[9][0] - w[0], pts[9][1] - w[1]) || 1e-3;
  return { pts, w, scale };
}

// frames: array of frames, each frame = array of hands, each hand = 21 landmarks.
// Returns MOTION_DIM numbers, or null when the clip is too short.
export function clipFeatures(frames, aspect = 1, mirror = false) {
  if (!frames || frames.length < MIN_CLIP_FRAMES) return null;
  const views = frames.map((hands) =>
    hands
      .slice(0, 2)
      .map((lm) => handView(lm, aspect, mirror))
      .sort((a, b) => a.w[0] - b.w[0]),
  );

  let cx = 0;
  let cy = 0;
  let sc = 0;
  let n = 0;
  views.forEach((vs) =>
    vs.forEach((v) => {
      cx += v.w[0];
      cy += v.w[1];
      sc += v.scale;
      n += 1;
    }),
  );
  if (!n) return null;
  cx /= n;
  cy /= n;
  sc /= n;

  const out = [];
  for (let k = 0; k < MOTION_FRAMES; k++) {
    const vs = views[Math.round((k * (views.length - 1)) / (MOTION_FRAMES - 1))];
    for (let slot = 0; slot < 2; slot++) {
      const v = vs[slot];
      for (let i = 0; i < 21; i++) {
        if (v) out.push(r3((v.pts[i][0] - v.w[0]) / v.scale), r3((v.pts[i][1] - v.w[1]) / v.scale));
        else out.push(0, 0);
      }
    }
    for (let slot = 0; slot < 2; slot++) {
      const v = vs[slot];
      if (v) out.push(r3(((v.w[0] - cx) / sc) * POS_WEIGHT), r3(((v.w[1] - cy) / sc) * POS_WEIGHT));
      else out.push(0, 0);
    }
  }
  return out;
}

function dtw(a, b, frameDim = FRAME_DIM) {
  const T = MOTION_FRAMES;
  const INF = 1e9;
  const D = Array.from({ length: T }, () => new Array(T).fill(INF));
  for (let i = 0; i < T; i++) {
    for (let j = Math.max(0, i - BAND); j <= Math.min(T - 1, i + BAND); j++) {
      let sum = 0;
      const ia = i * frameDim;
      const jb = j * frameDim;
      for (let d = 0; d < frameDim; d++) {
        const x = a[ia + d] - b[jb + d];
        sum += x * x;
      }
      const cost = Math.sqrt(sum / frameDim);
      let best = i === 0 && j === 0 ? 0 : INF;
      if (i > 0 && D[i - 1][j] < best) best = D[i - 1][j];
      if (j > 0 && D[i][j - 1] < best) best = D[i][j - 1];
      if (i > 0 && j > 0 && D[i - 1][j - 1] < best) best = D[i - 1][j - 1];
      D[i][j] = cost + best;
    }
  }
  return D[T - 1][T - 1] / T;
}

// How much do your own takes of each sign differ from each other? Takes are never identical, so
// the accepted distance is learned per sign: LIMIT_FACTOR x the typical distance between its own takes
// (kept between 0.6 x and 2.5 x `baseMax`). Signs with fewer than 3 takes use `baseMax`.
// Raise LIMIT_FACTOR if your own signs are rejected; lower it if wrong signs get accepted.
export const LIMIT_FACTOR = 1.3;
const thrCache = new WeakMap(); // sample array -> learned limit (only signs that changed are recomputed)
export function clipThresholds(signs, frameDim, baseMax) {
  const thr = {};
  for (const [label, arr] of Object.entries(signs)) {
    const cached = thrCache.get(arr);
    if (cached !== undefined && cached.frameDim === frameDim && cached.baseMax === baseMax) {
      thr[label] = cached.value;
      continue;
    }
    const takes = [];
    for (let i = 0; i < arr.length; i += 2) takes.push(arr[i]); // originals only (mirrored copies follow them)
    if (takes.length < 3) {
      thr[label] = baseMax;
      thrCache.set(arr, { frameDim, baseMax, value: baseMax });
      continue;
    }
    const step = Math.max(1, Math.ceil(takes.length / 20));
    const nn = [];
    for (let i = 0; i < takes.length; i += step) {
      let best = Infinity;
      for (let j = 0; j < takes.length; j++) {
        if (j === i) continue;
        const d = dtw(takes[i], takes[j], frameDim);
        if (d < best) best = d;
      }
      nn.push(best);
    }
    nn.sort((x, y) => x - y);
    const p75 = nn[Math.min(nn.length - 1, Math.floor(nn.length * 0.75))];
    thr[label] = Math.min(Math.max(p75 * LIMIT_FACTOR, baseMax * 0.6), baseMax * 2.5);
    thrCache.set(arr, { frameDim, baseMax, value: thr[label] });
  }
  return thr;
}

// Nearest taught clip per sign. A sign is accepted when its distance is within that sign's limit
// (`thresholds[label]`, else `maxDistance`). `guesses` lists the closest signs for display / tuning.
export function classifyMotion(
  moving,
  feat,
  frameDim = FRAME_DIM,
  maxDistance = MAX_MOTION_DISTANCE,
  thresholds = null,
  forceClosest = false,
) {
  const per = [];
  for (const [label, arr] of Object.entries(moving)) {
    let best = Infinity;
    for (const s of arr) {
      const d = dtw(s, feat, frameDim);
      if (d < best) best = d;
    }
    const limit = (thresholds && thresholds[label]) || maxDistance;
    per.push({ label, distance: best, limit, score: best / limit });
  }
  if (!per.length || !feat) return { label: "UNKNOWN", confidence: 0, distance: Infinity, limit: maxDistance, guesses: [] };
  per.sort((a, b) => a.score - b.score);
  const top = per[0];
  const guesses = per.slice(0, 3).map((x) => ({ label: x.label, distance: x.distance, limit: x.limit }));
  const ambiguous = per.length > 1 && per[1].score < top.score * 1.1; // two signs almost equally close
  if (top.score > 1) {
    if (forceClosest) return { label: top.label, confidence: 0.52, distance: top.distance, limit: top.limit, guesses, uncertain: true };
    return { label: "UNKNOWN", confidence: 0, distance: top.distance, limit: top.limit, guesses };
  }
  if (ambiguous) {
    // two signs almost equally close: show the closest one, marked as a guess
    return { label: top.label, confidence: 0.55, distance: top.distance, limit: top.limit, guesses, uncertain: true };
  }
  const confidence = Math.min(0.99, Math.max(0.5, 1 - top.score / 1.3));
  return { label: top.label, confidence, distance: top.distance, limit: top.limit, guesses };
}

// ---------------- Full-body signs: head + body + arms + both hands, over time ----------------
// Needs the MediaPipe Pose model. Every position is measured relative to the shoulders
// (centre = middle of the shoulders, unit = shoulder width), so it does not matter where you
// stand or how far you are from the camera. Per frame: both hand shapes, both wrists relative to
// the body, and 9 body points: nose + ears (head turn / nod / tilt), shoulders, elbows, wrists.
export const BODY_FRAME_DIM = SHAPE_DIM * 2 + 4 + 18; // 106
export const BODY_DIM = MOTION_FRAMES * BODY_FRAME_DIM; // 1696
export const MAX_BODY_DISTANCE = 0.45; // like MAX_MOTION_DISTANCE, for full-body signs
const BODY_WEIGHT = 5; // how much body/arm movement counts compared with finger shapes
const HEAD_WEIGHT = 12; // head points (nose, ears) move less, so they get extra weight
const BODY_POINTS = [0, 7, 8, 11, 12, 13, 14, 15, 16]; // nose, ears, shoulders, elbows, wrists
const MIRROR_SWAP = { 0: 0, 7: 8, 8: 7, 11: 12, 12: 11, 13: 14, 14: 13, 15: 16, 16: 15 };

function bodyView(pose, aspect, mirror) {
  if (!pose || pose.length < 17) return null;
  if ((pose[11].visibility ?? 1) < 0.3 || (pose[12].visibility ?? 1) < 0.3) return null;
  const sx = mirror ? -aspect : aspect;
  const get = (i) => {
    const p = pose[mirror ? MIRROR_SWAP[i] : i];
    return [p.x * sx, p.y];
  };
  const l = get(11);
  const r = get(12);
  const cx = (l[0] + r[0]) / 2;
  const cy = (l[1] + r[1]) / 2;
  const width = Math.hypot(l[0] - r[0], l[1] - r[1]) || 1e-3;
  return { cx, cy, width, pts: BODY_POINTS.map((i) => get(i)) };
}

// frames: array of { hands: [landmarks...], pose: 33 landmarks | null }.
// Returns BODY_DIM numbers, or null when the body was not seen well enough.
export function bodyClipFeatures(frames, aspect = 1, mirror = false) {
  if (!frames || frames.length < MIN_CLIP_FRAMES) return null;
  const bodies = frames.map((f) => bodyView(f.pose, aspect, mirror));
  const valid = bodies.filter(Boolean).length;
  if (valid < frames.length * 0.5) return null;
  // fill frames where the body was lost with the nearest frame where it was seen
  let last = null;
  for (let i = 0; i < bodies.length; i++) {
    if (bodies[i]) last = bodies[i];
    else bodies[i] = last;
  }
  let next = null;
  for (let i = bodies.length - 1; i >= 0; i--) {
    if (bodies[i]) next = bodies[i];
    else bodies[i] = next;
  }

  // average each body value with its neighbours (3 frames) to remove landmark jitter
  const smooth = bodies.map((b, i) => {
    const group = [bodies[Math.max(0, i - 1)], b, bodies[Math.min(bodies.length - 1, i + 1)]];
    const avg = (get) => group.reduce((sum, g) => sum + get(g), 0) / group.length;
    return {
      cx: avg((g) => g.cx),
      cy: avg((g) => g.cy),
      width: avg((g) => g.width),
      pts: b.pts.map((_, pi) => [avg((g) => g.pts[pi][0]), avg((g) => g.pts[pi][1])]),
    };
  });

  const views = frames.map((f) =>
    (f.hands || [])
      .slice(0, 2)
      .map((lm) => handView(lm, aspect, mirror))
      .sort((a, b) => a.w[0] - b.w[0]),
  );

  const out = [];
  for (let k = 0; k < MOTION_FRAMES; k++) {
    const idx = Math.round((k * (frames.length - 1)) / (MOTION_FRAMES - 1));
    const b = smooth[idx];
    const vs = views[idx];
    for (let slot = 0; slot < 2; slot++) {
      const v = vs[slot];
      for (let i = 0; i < 21; i++) {
        if (v) out.push(r3((v.pts[i][0] - v.w[0]) / v.scale), r3((v.pts[i][1] - v.w[1]) / v.scale));
        else out.push(0, 0);
      }
    }
    for (let slot = 0; slot < 2; slot++) {
      const v = vs[slot];
      if (v) out.push(r3(((v.w[0] - b.cx) / b.width) * BODY_WEIGHT), r3(((v.w[1] - b.cy) / b.width) * BODY_WEIGHT));
      else out.push(0, 0);
    }
    b.pts.forEach((p, pi) => {
      const wgt = pi < 3 ? HEAD_WEIGHT : BODY_WEIGHT; // first 3 points = nose + ears
      out.push(r3(((p[0] - b.cx) / b.width) * wgt), r3(((p[1] - b.cy) / b.width) * wgt));
    });
  }
  return out;
}

// ---------------- Permanent storage on the backend (per signed-in user) ----------------
// localStorage above is only a fast cache. The account copy is what survives cleared
// browser data, a different browser, a different port or a different device.

function authHeaders() {
  try {
    const token = localStorage.getItem("accessai_token");
    return token ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : null;
  } catch {
    return null;
  }
}

// Returns { label: samples[] } or null when signed out / server unreachable.
export async function fetchRemoteSigns() {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${API_URL}/api/sign-language/custom-signs`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.signs || {};
  } catch {
    return null;
  }
}

// Like fetchRemoteSigns, but says WHY it failed: { signs } or { error, authExpired?, signedOut? }
export async function fetchRemoteSignsDetailed() {
  const headers = authHeaders();
  if (!headers) return { error: "Not signed in", signedOut: true };
  try {
    const res = await fetch(`${API_URL}/api/sign-language/custom-signs`, { headers });
    if (res.status === 401) return { error: "Your login expired. Sign out and sign in again.", authExpired: true };
    if (!res.ok) return { error: await readError(res) };
    const data = await res.json();
    return { signs: data.signs || {} };
  } catch {
    return { error: "Could not reach the server" };
  }
}

// Quick check of what the account has: { counts: { label: sampleCount } } or { error, authExpired?, missing? }
// (`missing` = this backend is older and has no summary route)
export async function fetchRemoteSummary() {
  const headers = authHeaders();
  if (!headers) return { error: "Not signed in", signedOut: true };
  try {
    const res = await fetch(`${API_URL}/api/sign-language/custom-signs-summary`, { headers });
    if (res.status === 401) return { error: "Your login expired. Sign out and sign in again.", authExpired: true };
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: await readError(res) };
    const data = await res.json();
    const counts = {};
    (data.signs || []).forEach((s) => {
      counts[s.label] = s.count;
    });
    return { counts };
  } catch {
    return { error: "Could not reach the server" };
  }
}

// One sign's samples from the account, or null
export async function fetchRemoteSign(label) {
  const headers = authHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${API_URL}/api/sign-language/custom-signs/${encodeURIComponent(label)}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.samples || null;
  } catch {
    return null;
  }
}

// Remove the saved login so the app asks for a fresh sign-in
export function clearLogin() {
  try {
    localStorage.removeItem("accessai_token");
  } catch {
    /* ignore */
  }
}

// Returns "ok" | "signed-out" | "failed"
export async function saveRemoteSign(label, samples) {
  const headers = authHeaders();
  if (!headers) return "signed-out";
  try {
    const res = await fetch(`${API_URL}/api/sign-language/custom-signs/${encodeURIComponent(label)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ samples }),
    });
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

export async function deleteRemoteSign(label) {
  const headers = authHeaders();
  if (!headers) return "signed-out";
  try {
    const res = await fetch(`${API_URL}/api/sign-language/custom-signs/${encodeURIComponent(label)}`, {
      method: "DELETE",
      headers,
    });
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

// Account copy wins; signs that exist only on this device (or have more samples here)
// are kept and listed in `toUpload` so they get sent to the account.
export function mergeSigns(local, remote) {
  const merged = { ...remote };
  const toUpload = [];
  for (const [label, arr] of Object.entries(local)) {
    if (!merged[label] || arr.length > merged[label].length) {
      merged[label] = arr;
      toUpload.push(label);
    }
  }
  return { merged, toUpload };
}

// ---------------- Local cache in IndexedDB (localStorage holds only ~5 MB, 50+ signs need more) ----------------
const DB_NAME = "accessai-signs";
const DB_STORE = "signs";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// All signs saved on this device: { label: samples[] }. Signs saved by older versions in
// localStorage are picked up too.
export async function loadLocalSigns() {
  const out = {};
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const keys = store.getAllKeys();
      const vals = store.getAll();
      tx.oncomplete = () => {
        keys.result.forEach((k, i) => {
          out[k] = vals.result[i];
        });
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* IndexedDB unavailable: fall back to localStorage only */
  }
  const legacy = loadCustomSigns();
  for (const [label, arr] of Object.entries(legacy)) if (!out[label]) out[label] = arr;
  return out;
}

export async function putLocalSign(label, samples) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(samples, label);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function deleteLocalSign(label) {
  try {
    const legacy = loadCustomSigns();
    if (label in legacy) {
      delete legacy[label];
      saveCustomSigns(legacy);
    }
  } catch {
    /* ignore */
  }
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(label);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

// ---------------- Account sync with clear error messages ----------------
export function hasToken() {
  try {
    return !!localStorage.getItem("accessai_token");
  } catch {
    return false;
  }
}

async function readError(res) {
  if (res.status === 401) return "Your login expired. Sign out and sign in again.";
  try {
    const data = await res.json();
    if (data && data.error) return data.error;
  } catch {
    /* not JSON */
  }
  if (res.status === 404) return "The backend is missing the taught-sign routes. Copy the new routes/signLanguage.js and restart the backend.";
  if (res.status === 429) return "Too many requests to the server. Wait a few minutes and try again.";
  if (res.status === 413) return "The sign is too large for the server.";
  return `Server error ${res.status}`;
}

const AUTH_EXPIRED_MSG = "Your login expired. Sign out and sign in again.";

// JSON turns NaN into null and the server would reject it, so make every value a real number
export function cleanSamples(samples) {
  return samples.map((row) => row.map((v) => (Number.isFinite(v) ? v : 0)));
}

// Send JSON, gzip-compressed when the browser can (the numbers shrink about 3-4x, so uploads are much faster).
// Express reads gzip bodies by itself. If compressed sending fails, plain JSON is used from then on.
let gzipBroken = false;
async function sendJson(url, method, headers, obj) {
  const json = JSON.stringify(obj);
  if (!gzipBroken && typeof CompressionStream !== "undefined" && json.length > 20000) {
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const body = await new Response(stream).blob();
      const res = await fetch(url, { method, headers: { ...headers, "Content-Encoding": "gzip" }, body });
      if (res.status !== 400 && res.status !== 415) return res;
    } catch {
      /* blocked by CORS or the network: fall through to plain JSON */
    }
    gzipBroken = true;
  }
  return fetch(url, { method, headers, body: json });
}

// Older backends only have PUT /custom-signs/:label (no batch route): save one sign at a time
let batchMissing = false;
async function saveRemoteOne(label, samples, headers) {
  try {
    const res = await sendJson(`${API_URL}/api/sign-language/custom-signs/${encodeURIComponent(label)}`, "PUT", headers, {
      samples: cleanSamples(samples),
    });
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, error: await readError(res) };
  } catch {
    return { ok: false, error: "Could not reach the server" };
  }
}

// entries: [[label, samples], ...]. Sends them in groups of about 1.5 MB.
// onProgress({ done, total }) is called after each group so the page can show progress.
// Returns { saved: [labels], failed: [{ label, error }], signedOut }
export async function saveRemoteBatch(entries, onProgress) {
  const headers = authHeaders();
  if (!headers) {
    return { saved: [], failed: entries.map(([label]) => ({ label, error: "Not signed in" })), signedOut: true };
  }
  const chunks = [];
  let cur = {};
  let size = 0;
  for (const [label, samples] of entries) {
    const est = samples.length * (samples[0] ? samples[0].length : 0) * 7;
    if (Object.keys(cur).length && size + est > 1_500_000) {
      chunks.push(cur);
      cur = {};
      size = 0;
    }
    cur[label] = cleanSamples(samples);
    size += est;
  }
  if (Object.keys(cur).length) chunks.push(cur);

  const saved = [];
  const failed = [];
  let authExpired = false;
  let done = 0;
  for (const signs of chunks) {
    if (onProgress) onProgress({ done, total: entries.length });
    done += Object.keys(signs).length;
    if (authExpired) {
      Object.keys(signs).forEach((label) => failed.push({ label, error: AUTH_EXPIRED_MSG }));
      continue;
    }
    if (batchMissing) {
      if (await saveEachSign(signs, headers, saved, failed)) authExpired = true;
      continue;
    }
    try {
      const res = await sendJson(`${API_URL}/api/sign-language/custom-signs/batch`, "POST", headers, { signs });
      if (res.status === 404) {
        batchMissing = true; // this backend has no batch route: use the one-by-one route instead
        if (await saveEachSign(signs, headers, saved, failed)) authExpired = true;
        continue;
      }
      if (!res.ok) {
        if (res.status === 401) authExpired = true;
        const error = await readError(res);
        Object.keys(signs).forEach((label) => failed.push({ label, error }));
        continue;
      }
      const data = await res.json();
      saved.push(...(data.saved || []));
      failed.push(...(data.failed || []));
    } catch {
      Object.keys(signs).forEach((label) => failed.push({ label, error: "Could not reach the server" }));
    }
  }
  if (onProgress) onProgress({ done: entries.length, total: entries.length });
  return { saved, failed, signedOut: false, authExpired };
}

// Returns true when the login was rejected (401)
async function saveEachSign(signs, headers, saved, failed) {
  const labels = Object.keys(signs);
  for (let i = 0; i < labels.length; i++) {
    const r = await saveRemoteOne(labels[i], signs[labels[i]], headers);
    if (r.ok) {
      saved.push(labels[i]);
    } else if (r.status === 401 || r.status === 429) {
      // login rejected or rate limited: the rest would fail too, so stop and report it
      for (let j = i; j < labels.length; j++) failed.push({ label: labels[j], error: r.error });
      return r.status === 401;
    } else {
      failed.push({ label: labels[i], error: r.error });
    }
  }
  return false;
}