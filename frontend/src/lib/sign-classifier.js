// Rotation-invariant static hand-gesture classifier for MediaPipe's 21 hand landmarks.
// 0 wrist | thumb 1-4 | index 5-8 | middle 9-12 | ring 13-16 | pinky 17-20

export const SIGN_VOCABULARY = {
  FIST: "STOP",
  OPEN_PALM: "HELLO",
  THUMBS_UP: "GOOD",
  PEACE: "PEACE",
  POINTING: "YOU",
  PINCH: "SMALL",
  OK: "OK",
  I_LOVE_YOU: "I LOVE YOU",
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function classifyGesture(lm) {
  if (!lm || lm.length < 21) return { label: "UNKNOWN", confidence: 0 };

  const hand = dist(lm[0], lm[9]) || 1; // wrist -> middle knuckle, used to normalise sizes

  // A finger is extended when its tip is clearly farther from the wrist than its middle joint.
  const ext = (tip, pip) => dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.08;
  const index = ext(8, 6);
  const middle = ext(12, 10);
  const ring = ext(16, 14);
  const pinky = ext(20, 18);
  const thumb = dist(lm[4], lm[5]) / hand > 0.65; // thumb tip far from the index knuckle

  const count = [index, middle, ring, pinky].filter(Boolean).length;
  const others = [middle, ring, pinky].filter(Boolean).length;
  // Thumb meets index fingertip while the index is still out past its knuckle (a fist also
  // brings them close, but the curled index tip stays inside the knuckle distance).
  const pinching =
    dist(lm[4], lm[8]) / hand < 0.3 && dist(lm[8], lm[0]) > dist(lm[5], lm[0]);

  if (pinching) {
    if (others >= 2) return { label: "OK", confidence: 0.85 };
    if (others === 0) return { label: "PINCH", confidence: 0.8 };
  }
  if (count === 0) {
    if (thumb && lm[4].y < lm[3].y && lm[4].y < lm[5].y) {
      return { label: "THUMBS_UP", confidence: 0.9 };
    }
    if (!thumb) return { label: "FIST", confidence: 0.85 };
    return { label: "UNKNOWN", confidence: 0.3 };
  }
  if (thumb && index && !middle && !ring && pinky) return { label: "I_LOVE_YOU", confidence: 0.85 };
  if (index && middle && !ring && !pinky) return { label: "PEACE", confidence: 0.85 };
  if (index && !middle && !ring && !pinky) return { label: "POINTING", confidence: 0.85 };
  if (count === 4) return { label: "OPEN_PALM", confidence: thumb ? 0.95 : 0.85 };
  return { label: "UNKNOWN", confidence: 0.3 };
}