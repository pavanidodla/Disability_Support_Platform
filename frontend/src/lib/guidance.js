// Navigation guidance from object detections.
// The camera is not mirrored, so image-left = the user's left.
// Frame is split into three lanes: left | ahead | right.
import { objectLabel } from "@/i18n/object-labels";

const NEAR_RATIO = 0.08; // bbox area / frame area
const VERY_CLOSE_RATIO = 0.3;
const SIDE_LIMIT = 0.5; // a side lane counts as "free" if less than this much is covered

const overlap = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

function distanceOf(areaRatio) {
  if (areaRatio >= VERY_CLOSE_RATIO) return "very close";
  if (areaRatio >= NEAR_RATIO) return "near";
  return "far";
}

function zoneOf(centerX) {
  if (centerX < 1 / 3) return "left";
  if (centerX > 2 / 3) return "right";
  return "ahead";
}

// Fraction of a side lane covered by objects that are near or closer
function laneCoverage(items, from, to) {
  let covered = 0;
  items.forEach((it) => {
    if (it.distance === "far") return;
    covered += overlap(it.left, it.right, from, to) / (to - from);
  });
  return Math.min(1, covered);
}

/**
 * dets: [{ label, confidence, bbox: {x, y, w, h} }] in video pixels
 * Returns language-independent data:
 *   { items, severity, direction, blocker, sideNotes, key }
 *   severity : "danger" | "warning" | "clear"
 *   direction: "left" | "right" | "stop" | null
 *   blocker  : { label, distance } | null
 *   sideNotes: [{ label, zone, distance }]
 * Use formatGuidance() to turn it into text in the current language.
 */
export function analyzeScene(dets, width, height) {
  const frameArea = width * height || 1;

  const items = dets.map((d) => {
    const left = d.bbox.x / width;
    const right = (d.bbox.x + d.bbox.w) / width;
    const areaRatio = (d.bbox.w * d.bbox.h) / frameArea;
    return { ...d, left, right, zone: zoneOf((left + right) / 2), distance: distanceOf(areaRatio), areaRatio };
  });

  // Objects in (or overlapping) the walking path that are close enough to matter
  const blockers = items
    .filter((it) => it.distance !== "far" && it.right > 1 / 3 && it.left < 2 / 3)
    .sort((a, b) => b.areaRatio - a.areaRatio);

  // Nearby objects that are off to the side
  const blockerSet = new Set(blockers);
  const sideNotes = items
    .filter((it) => !blockerSet.has(it) && it.distance !== "far")
    .sort((a, b) => b.areaRatio - a.areaRatio)
    .slice(0, 2)
    .map((it) => ({ label: it.label, zone: it.zone, distance: it.distance }));
  const sideKey = sideNotes.map((n) => `${n.label}:${n.zone}:${n.distance}`).join(",");

  if (blockers.length === 0) {
    return { items, severity: "clear", direction: null, blocker: null, sideNotes, key: `clear|${sideKey}` };
  }

  const top = blockers[0];
  const leftCover = laneCoverage(items, 0, 1 / 3);
  const rightCover = laneCoverage(items, 2 / 3, 1);

  let direction;
  if (leftCover >= SIDE_LIMIT && rightCover >= SIDE_LIMIT) direction = "stop";
  else if (leftCover >= SIDE_LIMIT) direction = "right";
  else if (rightCover >= SIDE_LIMIT) direction = "left";
  else if (Math.abs(leftCover - rightCover) > 0.05) direction = leftCover < rightCover ? "left" : "right";
  else direction = (top.left + top.right) / 2 < 0.5 ? "right" : "left"; // go away from the object

  const severity = blockers.some((b) => b.distance === "very close") ? "danger" : "warning";
  return {
    items,
    severity,
    direction,
    blocker: { label: top.label, distance: top.distance },
    sideNotes,
    key: `${severity}|${top.label}|${top.distance}|${direction}`,
  };
}

/**
 * Build the on-screen message and the spoken sentence in the current language.
 * t = translate function, lang = language code.
 */
export function formatGuidance(g, t, lang) {
  const name = (label) => objectLabel(label, lang);
  const sideTexts = g.sideNotes.map((n) =>
    t(
      n.zone === "left"
        ? "{object} on your left, {distance}"
        : n.zone === "right"
          ? "{object} on your right, {distance}"
          : "{object} ahead, {distance}",
      { object: name(n.label), distance: t(n.distance) },
    ),
  );

  if (!g.blocker) {
    const message = t("Path is clear");
    return { message, sideNotes: sideTexts, spoken: [`${message}.`, ...sideTexts.map((s) => `${s}.`)].join(" ") };
  }

  const about = t("{object} ahead, {distance}", { object: name(g.blocker.label), distance: t(g.blocker.distance) });
  const move =
    g.direction === "stop" ? t("Path blocked, stop") : g.direction === "left" ? t("Move left") : t("Move right");
  const message = g.severity === "danger" ? `${t("Stop")}. ${about}. ${move}` : `${about}. ${move}`;
  return { message, sideNotes: sideTexts, spoken: [`${message}.`, ...sideTexts.map((s) => `${s}.`)].join(" ") };
}
