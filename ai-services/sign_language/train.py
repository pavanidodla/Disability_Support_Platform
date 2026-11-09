#!/usr/bin/env python3
"""
Train a sign classifier from hand landmarks and export it for the browser.

Data sources (use either or both):
  --csv    files recorded in the app's "Record samples" panel
  --images a folder of images in one sub-folder per sign:  data/A/img1.jpg, data/B/img2.jpg ...
           (Indian Sign Language photos you collected). Needs --task hand_landmarker.task

Example:
  python train.py --language isl --csv a.csv b.csv c.csv --out ../../frontend/public/sign-models/isl.json

Generalising to NEW people: record each person under their own signer name. With 2+ signers the
script validates "leave one signer out" (train on everyone else, test on the person left out),
which is the honest estimate of how it will do for someone it has never seen.
"""
import argparse, csv, json, math, os, sys
import numpy as np


def to_features(pts):
    """pts: (21,3) already aspect-corrected. Must match toFeatures() in sign-model.js."""
    pts = np.asarray(pts, dtype=np.float64)
    rel = pts - pts[0]
    scale = max(1e-6, float(np.max(np.linalg.norm(rel, axis=1))))
    return (rel / scale).reshape(-1).astype(np.float32)


def aspect_correct(raw, aspect):
    raw = np.asarray(raw, dtype=np.float64).reshape(21, 3).copy()
    raw[:, 0] *= aspect
    raw[:, 2] *= aspect
    return raw


def augment(pts, rng):
    """Simulate other people and camera angles. Applied to TRAIN only.
    3D rotation, hand-proportion changes (wider/narrower/longer), mirror, jitter."""
    p = pts - pts[0]
    ax, ay, az = [math.radians(rng.uniform(-25, 25)) for _ in range(3)]
    cx, sx, cy, sy, cz, sz = math.cos(ax), math.sin(ax), math.cos(ay), math.sin(ay), math.cos(az), math.sin(az)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    p = p @ (Rz @ Ry @ Rx).T
    p = p * rng.uniform(0.88, 1.12, 3)           # different hand proportions
    if rng.random() < 0.5:                        # a left hand is a mirrored right hand
        p[:, 0] = -p[:, 0]
        p[:, 2] = -p[:, 2]
    tip_scale = rng.uniform(0.93, 1.07, 5)        # finger length varies between people
    for f, k in enumerate(tip_scale):
        for j in range(1 + 4 * f, 5 + 4 * f):
            p[j] = p[0] + (p[j] - p[0]) * k
    p += rng.normal(0, 0.006, p.shape)
    return p


def load_csv(paths):
    """Rows: label, signer, aspect, 63 values   (older files without a signer column also work)."""
    X, y, who = [], [], []
    for path in paths:
        with open(path, newline="") as f:
            for row in csv.reader(f):
                if not row or row[0] == "label":
                    continue
                if len(row) >= 66:
                    label, signer, aspect, vals = row[0], row[1], float(row[2]), row[3:66]
                else:
                    label, signer, aspect, vals = row[0], "unknown", float(row[1]), row[2:65]
                vals = [float(v) for v in vals]
                if len(vals) != 63:
                    continue
                X.append(aspect_correct(vals, aspect)); y.append(label); who.append(signer)
    return X, y, who


def load_images(root, task_path):
    import cv2
    import mediapipe as mp
    opts = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=task_path),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.5,
    )
    det = mp.tasks.vision.HandLandmarker.create_from_options(opts)
    X, y, who, seen, found = [], [], [], 0, 0
    for label in sorted(os.listdir(root)):
        d = os.path.join(root, label)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            img = cv2.imread(os.path.join(d, name))
            if img is None:
                continue
            seen += 1
            h, w = img.shape[:2]
            res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
            if res.hand_landmarks:
                found += 1
                raw = [[l.x, l.y, l.z] for l in res.hand_landmarks[0]]
                X.append(aspect_correct(raw, w / h))
                y.append(label)
                who.append("images")
    print(f"Hand found in {found}/{seen} images ({100 * found / max(seen, 1):.0f}%)")
    return X, y, who


def block_split(y, val_frac):
    """Per sign, keep the LAST part of the recording for validation. Consecutive frames are
    near-identical, so a random split would leak and report fake-high accuracy."""
    idx_by = {}
    for i, l in enumerate(y):
        idx_by.setdefault(l, []).append(i)
    tr, va = [], []
    for l, idx in idx_by.items():
        k = max(1, int(len(idx) * val_frac))
        tr += idx[:-k]
        va += idx[-k:]
    return tr, va


def fit(X, y, idx, aug, rng):
    from sklearn.neural_network import MLPClassifier
    Xf, yf = [], []
    for i in idx:
        Xf.append(to_features(X[i])); yf.append(y[i])
        for _ in range(aug):
            Xf.append(to_features(augment(X[i], rng))); yf.append(y[i])
    clf = MLPClassifier(hidden_layer_sizes=(128, 64), activation="relu", max_iter=400,
                        early_stopping=True, random_state=0)
    clf.fit(np.array(Xf), yf)
    return clf


def evaluate(clf, X, y, idx):
    Xv = np.array([to_features(X[i]) for i in idx])
    return float(clf.score(Xv, [y[i] for i in idx])) if len(idx) else float("nan")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--language", required=True)
    ap.add_argument("--csv", nargs="*", default=[])
    ap.add_argument("--images")
    ap.add_argument("--task", default="hand_landmarker.task")
    ap.add_argument("--out", required=True)
    ap.add_argument("--aug", type=int, default=10, help="augmented copies per training sample")
    ap.add_argument("--val", type=float, default=0.2)
    args = ap.parse_args()

    X, y, who = [], [], []
    if args.csv:
        a, b, c = load_csv(args.csv); X += a; y += b; who += c
    if args.images:
        a, b, c = load_images(args.images, args.task); X += a; y += b; who += c
    if not X:
        sys.exit("No training samples found.")

    counts = {l: y.count(l) for l in sorted(set(y))}
    signers = sorted(set(w for w in who if w not in ("unknown", "images")))
    print("Samples per sign:", counts)
    print("Signers:", signers or "none named")
    thin = [l for l, n in counts.items() if n < 60]
    if thin:
        print(f"WARNING: fewer than 60 samples for {thin}.")
    if len(counts) < 2:
        sys.exit("Need at least 2 different signs.")

    rng = np.random.default_rng(0)
    all_idx = list(range(len(X)))
    if len(signers) >= 2:
        print("\nLeave-one-signer-out check (train on everyone else, test on the person left out):")
        accs = {}
        for s_ in signers:
            te = [i for i in all_idx if who[i] == s_]
            tr = [i for i in all_idx if who[i] != s_]
            accs[s_] = evaluate(fit(X, y, tr, args.aug, rng), X, y, te)
            print(f"  {s_:20s} {accs[s_] * 100:5.1f}%")
        acc = float(np.mean(list(accs.values())))
        worst = min(accs, key=accs.get)
        print(f"  mean on unseen signers: {acc * 100:.1f}%   (weakest: {worst}, {accs[worst] * 100:.1f}%)")
        if len(signers) < 5:
            print(f"WARNING: only {len(signers)} signers. Use 10+ for results you can trust on new people.")
        meta_extra = {"unseen_signer_accuracy": round(acc, 4), "signers": len(signers)}
    else:
        print("\nWARNING: fewer than 2 named signers, so accuracy on NEW people cannot be measured.")
        print("Record each person under their own signer name. Using a same-person split instead.")
        tr, va = block_split(y, args.val)
        acc = evaluate(fit(X, y, tr, args.aug, rng), X, y, va)
        print(f"  same-people accuracy: {acc * 100:.1f}% (optimistic)")
        meta_extra = {"unseen_signer_accuracy": None, "signers": len(signers)}

    # Final model uses ALL the data
    clf = fit(X, y, all_idx, args.aug, rng)
    layers = [{"W": W.astype(float).round(6).tolist(), "b": b.astype(float).round(6).tolist()}
              for W, b in zip(clf.coefs_, clf.intercepts_)]
    model = {
        "language": args.language,
        "labels": [str(c) for c in clf.classes_],
        "layers": layers,
        "meta": {"val_accuracy": round(acc, 4), "samples": counts,
                 "features": "wrist-relative, max-norm, aspect-corrected, 21x3", **meta_extra},
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(model, f)
    print(f"\nSaved {args.out}")


if __name__ == "__main__":
    main()