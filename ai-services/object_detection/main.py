"""
AccessAI - Object Detection Service (Multi-Object)
Detects: people, faces, bodies, vehicles (plates), general obstacles
Gives voice guidance: "move left", "move right", "obstacle ahead"
Does nothing when path is clear
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64

app = Flask(__name__)
CORS(app)

# Load all available classifiers
face_cascade = None
body_cascade = None
upper_body_cascade = None
plate_cascade = None
hog_detector = None


def load_classifiers():
    global face_cascade, body_cascade, upper_body_cascade, plate_cascade, hog_detector

    data_path = cv2.data.haarcascades

    face_cascade = cv2.CascadeClassifier(data_path + 'haarcascade_frontalface_default.xml')
    body_cascade = cv2.CascadeClassifier(data_path + 'haarcascade_fullbody.xml')
    upper_body_cascade = cv2.CascadeClassifier(data_path + 'haarcascade_upperbody.xml')
    plate_cascade = cv2.CascadeClassifier(data_path + 'haarcascade_russian_plate_number.xml')

    hog_detector = cv2.HOGDescriptor()
    hog_detector.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())

    print("✓ All classifiers loaded (face, body, upper-body, plate, HOG)")


def detect_objects(frame):
    """Multi-method object detection for road/outdoor scenes"""
    detections = []
    height, width = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # --- 1. HOG People Detection (best for pedestrians) ---
    try:
        small = cv2.resize(gray, (320, 240))
        boxes, weights = hog_detector.detectMultiScale(
            small, winStride=(4, 4), padding=(4, 4), scale=1.05
        )
        sx, sy = width / 320, height / 240
        for i, (x, y, w, h) in enumerate(boxes):
            conf = float(weights[i]) if i < len(weights) else 0.7
            detections.append({
                'label': 'Person',
                'confidence': round(min(conf, 0.99), 2),
                'bbox': {'x': int(x * sx), 'y': int(y * sy), 'w': int(w * sx), 'h': int(h * sy)}
            })
    except Exception:
        pass

    # --- 2. Face Detection ---
    try:
        faces = face_cascade.detectMultiScale(gray, 1.2, 4, minSize=(30, 30))
        for (x, y, w, h) in faces:
            detections.append({
                'label': 'Face',
                'confidence': 0.92,
                'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
            })
    except Exception:
        pass

    # --- 3. Full Body Detection ---
    try:
        bodies = body_cascade.detectMultiScale(gray, 1.1, 3, minSize=(50, 80))
        for (x, y, w, h) in bodies:
            detections.append({
                'label': 'Pedestrian',
                'confidence': 0.85,
                'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
            })
    except Exception:
        pass

    # --- 4. Upper Body Detection ---
    try:
        upper = upper_body_cascade.detectMultiScale(gray, 1.1, 3, minSize=(40, 50))
        for (x, y, w, h) in upper:
            detections.append({
                'label': 'Person',
                'confidence': 0.80,
                'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
            })
    except Exception:
        pass

    # --- 5. License Plate / Vehicle Detection ---
    try:
        plates = plate_cascade.detectMultiScale(gray, 1.1, 3, minSize=(60, 20))
        for (x, y, w, h) in plates:
            detections.append({
                'label': 'Vehicle',
                'confidence': 0.88,
                'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
            })
    except Exception:
        pass

    # --- 6. General Obstacle Detection (contours + edges) ---
    try:
        edges = cv2.Canny(gray, 50, 150)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated = cv2.dilate(edges, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 3000:  # significant obstacle
                x, y, w, h = cv2.boundingRect(cnt)
                aspect = w / h if h > 0 else 0

                # Classify by shape
                if 0.3 < aspect < 3.0 and area > 5000:
                    label = 'Obstacle'
                    if area > 15000 and aspect > 1.5:
                        label = 'Vehicle'
                    elif area > 15000 and aspect < 0.8:
                        label = 'Structure'
                    elif area < 8000:
                        label = 'Object'

                    # Avoid duplicates with existing detections
                    overlap = False
                    for existing in detections:
                        ex = existing['bbox']
                        ix = max(x, ex['x'])
                        iy = max(y, ex['y'])
                        iw = min(x + w, ex['x'] + ex['w']) - ix
                        ih = min(y + h, ex['y'] + ex['h']) - iy
                        if iw > 0 and ih > 0 and (iw * ih) > (w * h * 0.3):
                            overlap = True
                            break

                    if not overlap:
                        detections.append({
                            'label': label,
                            'confidence': 0.70,
                            'bbox': {'x': int(x), 'y': int(y), 'w': int(w), 'h': int(h)}
                        })
    except Exception:
        pass

    return detections


def merge_close_detections(detections, distance_threshold=50):
    """Merge overlapping detections of the same type"""
    if not detections:
        return detections

    merged = []
    used = set()

    for i, d1 in enumerate(detections):
        if i in used:
            continue
        group = [d1]
        for j, d2 in enumerate(detections):
            if j <= i or j in used:
                continue
            if d1['label'] == d2['label']:
                b1, b2 = d1['bbox'], d2['bbox']
                ix = max(b1['x'], b2['x'])
                iy = max(b1['y'], b2['y'])
                iw = min(b1['x'] + b1['w'], b2['x'] + b2['w']) - ix
                ih = min(b1['y'] + b1['h'], b2['y'] + b2['h']) - iy
                if iw > 0 and ih > 0:
                    group.append(d2)
                    used.add(j)

        best = max(group, key=lambda d: d['confidence'])
        merged.append(best)
        used.add(i)

    return merged


def get_voice_guidance(detections, frame_width):
    """Return navigation guidance based on obstacle positions"""
    if not detections:
        return None  # Path is clear - do nothing

    left_count = 0
    right_count = 0
    center_count = 0

    for det in detections:
        cx = det['bbox']['x'] + det['bbox']['w'] // 2
        if cx < frame_width // 3:
            left_count += 1
        elif cx > 2 * frame_width // 3:
            right_count += 1
        else:
            center_count += 1

    if center_count > 0:
        return "obstacle ahead"
    elif left_count > 0 and right_count > 0:
        return "obstacles on both sides"
    elif left_count > 0:
        return "move right"
    else:
        return "move left"


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'object_detection', 'port': 5001})


@app.route('/detect', methods=['POST'])
def detect_file():
    """Accept file upload"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image'}), 400
        file = request.files['image']
        nparr = np.frombuffer(file.read(), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({'error': 'Invalid image'}), 400

        h, w = frame.shape[:2]
        if max(h, w) > 480:
            scale = 480 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        detections = detect_objects(frame)
        detections = merge_close_detections(detections)
        voice = get_voice_guidance(detections, frame.shape[1])

        return jsonify({
            'success': True,
            'detections': detections,
            'count': len(detections),
            'voice_guidance': voice
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/detect-base64', methods=['POST'])
def detect_base64():
    """Accept JSON with base64 image (used by frontend via backend)"""
    try:
        data = request.get_json()
        if 'image' not in data:
            return jsonify({'error': 'No image data'}), 400

        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({'error': 'Invalid image'}), 400

        h, w = frame.shape[:2]
        if max(h, w) > 480:
            scale = 480 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        detections = detect_objects(frame)
        detections = merge_close_detections(detections)
        voice = get_voice_guidance(detections, frame.shape[1])

        return jsonify({
            'success': True,
            'detections': detections,
            'count': len(detections),
            'voice_guidance': voice
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/detect-video-frame', methods=['POST'])
def detect_video_frame():
    """Accept video frame as base64"""
    try:
        data = request.get_json()
        if 'frame' not in data:
            return jsonify({'error': 'No frame'}), 400

        frame_data = data['frame']
        if ',' in frame_data:
            frame_data = frame_data.split(',')[1]

        nparr = np.frombuffer(base64.b64decode(frame_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return jsonify({'error': 'Invalid frame'}), 400

        h, w = frame.shape[:2]
        if max(h, w) > 320:
            scale = 320 / max(h, w)
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        detections = detect_objects(frame)
        detections = merge_close_detections(detections)
        voice = get_voice_guidance(detections, frame.shape[1])

        return jsonify({
            'success': True,
            'detections': detections,
            'count': len(detections),
            'voice_guidance': voice
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("AccessAI Object Detection Service (Multi-Object)")
    print("=" * 50)
    load_classifiers()
    print("Starting on port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)