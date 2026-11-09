// Taught (user-recorded) signs: feature extraction, storage and a small kNN classifier.
// Put this file at: frontend/src/lib/custom-signs.js

const STORAGE_KEY = "accessai.customSigns.v1";

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
    .map(([label, arr]) => ({ label, count: Math.floor(arr.length / 2) })) // /2: originals + mirrored
    .sort((a, b) => a.label.localeCompare(b.label));
}

// k-nearest-neighbour over all taught samples.
export function classifyCustom(signs, feat) {
  const near = [];
  for (const [label, arr] of Object.entries(signs)) {
    for (const s of arr) {
      let d = 0;
      for (let i = 0; i < 63; i++) {
        const diff = s[i] - feat[i];
        d += diff * diff;
      }
      near.push([d, label]);
    }
  }
  if (near.length < K) return { label: "UNKNOWN", confidence: 0 };

  near.sort((a, b) => a[0] - b[0]);
  const nearest = Math.sqrt(near[0][0]);
  if (nearest > MAX_DISTANCE) return { label: "UNKNOWN", confidence: 0 };

  const votes = {};
  for (let i = 0; i < K; i++) votes[near[i][1]] = (votes[near[i][1]] || 0) + 1;
  const [label, count] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  const share = count / K;
  if (share < 0.6) return { label: "UNKNOWN", confidence: 0 };

  const closeness = 1 - nearest / (MAX_DISTANCE * 1.4); // 1 = identical, ~0.28 at the limit
  return { label, confidence: Math.min(0.99, share * (0.5 + closeness)) };
}