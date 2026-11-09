"""
AccessAI - Sign Language Recognition Service (MediaPipe 1.0+)
American Sign Language (ASL) detection using MediaPipe Tasks API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import mediapipe as mp
from datetime import datetime

app = Flask(__name__)
CORS(app)

# MediaPipe Tasks API setup
BaseOptions = mp.tasks.BaseOptions
VisionRunningMode = mp.tasks.vision.RunningMode
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions

hand_landmarker = None

def load_model():
    """Load MediaPipe hand landmark model"""
    global hand_landmarker
    
    try:
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
            running_mode=VisionRunningMode.IMAGE,
            num_hands=1,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        hand_landmarker = HandLandmarker.create_from_options(options)
        print("✓ Hand landmark model loaded")
        return True
    except Exception as e:
        print(f"⚠ Could not load hand landmark model: {e}")
        print("  Using fallback detection")
        return False

def classify_hand_gesture(landmarks):
    """Classify hand gesture based on landmark positions"""
    if not landmarks or len(landmarks) < 21:
        return 'unknown'
    
    index_tip = landmarks[8]
    middle_tip = landmarks[12]
    ring_tip = landmarks[16]
    pinky_tip = landmarks[20]
    
    index_pip = landmarks[6]
    middle_pip = landmarks[10]
    ring_pip = landmarks[14]
    pinky_pip = landmarks[18]
    
    index_extended = index_tip['y'] < index_pip['y']
    middle_extended = middle_tip['y'] < middle_pip['y']
    ring_extended = ring_tip['y'] < ring_pip['y']
    pinky_extended = pinky_tip['y'] < pinky_pip['y']
    
    fingers_up = sum([index_extended, middle_extended, ring_extended, pinky_extended])
    
    if fingers_up == 0:
        return 'fist'
    elif fingers_up == 1 and index_extended:
        return 'pointing'
    elif fingers_up == 2 and index_extended and middle_extended:
        return 'peace'
    elif fingers_up == 3:
        return 'three'
    elif fingers_up == 4:
        return 'four'
    elif fingers_up == 5:
        return 'open_hand'
    
    return 'unknown'

def gesture_to_letter(gesture):
    """Map gesture to ASL letter"""
    mapping = {
        'open_hand': 'B',
        'fist': 'S',
        'pointing': 'D',
        'peace': 'V',
        'three': 'W',
        'four': '4'
    }
    return mapping.get(gesture, 'unknown')

def process_frame(frame):
    """Process frame for sign language detection"""
    detections = []
    
    if hand_landmarker:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        result = hand_landmarker.detect(mp_image)
        
        if result.hand_landmarks:
            for hand_landmarks in result.hand_landmarks:
                landmarks = [{'x': lm.x, 'y': lm.y, 'z': lm.z} for lm in hand_landmarks]
                gesture = classify_hand_gesture(landmarks)
                letter = gesture_to_letter(gesture)
                
                detections.append({
                    'letter': letter,
                    'gesture': gesture,
                    'confidence': 0.85,
                    'landmarks': landmarks
                })
    else:
        # Fallback: Use OpenCV for basic hand detection
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        lower_skin = np.array([0, 20, 70])
        upper_skin = np.array([20, 255, 255])
        mask = cv2.inRange(hsv, lower_skin, upper_skin)
        
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            if cv2.contourArea(contour) > 5000:
                x, y, w, h = cv2.boundingRect(contour)
                detections.append({
                    'letter': 'hand_detected',
                    'gesture': 'open_hand',
                    'confidence': 0.6,
                    'bbox': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)}
                })
                break
    
    return detections

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'sign_language',
        'model_loaded': hand_landmarker is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/detect-sign', methods=['POST'])
def detect_sign():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        nparr = np.frombuffer(file.read(), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image format'}), 400
        
        detections = process_frame(frame)
        
        return jsonify({
            'success': True,
            'detections': detections,
            'count': len(detections),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/detect-sign-base64', methods=['POST'])
def detect_sign_base64():
    try:
        data = request.get_json()
        if 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
        
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        detections = process_frame(frame)
        
        return jsonify({
            'success': True,
            'detections': detections,
            'count': len(detections),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/detect-video-frame', methods=['POST'])
def detect_video_frame():
    try:
        data = request.get_json()
        if 'frame' not in data:
            return jsonify({'error': 'No frame data provided'}), 400
        
        frame_data = data['frame']
        if ',' in frame_data:
            frame_data = frame_data.split(',')[1]
        
        nparr = np.frombuffer(base64.b64decode(frame_data), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid frame data'}), 400
        
        detections = process_frame(frame)
        
        return jsonify({
            'success': True,
            'detections': detections,
            'count': len(detections),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate-sign-to-text', methods=['POST'])
def translate_sign_to_text():
    try:
        data = request.get_json()
        if 'signs' not in data:
            return jsonify({'error': 'No signs provided'}), 400
        
        signs = data['signs']
        text = ''.join([sign.get('letter', '') for sign in signs if sign.get('letter')])
        
        return jsonify({
            'success': True,
            'text': text,
            'sign_count': len(signs),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("AccessAI Sign Language Recognition Service")
    print("=" * 40)
    load_model()
    print("Starting server on port 5003...")
    app.run(host='0.0.0.0', port=5003, debug=False)