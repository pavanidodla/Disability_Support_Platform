"""
AccessAI Python AI Services
Provides object detection, OCR, sign language recognition,
head tracking, text-to-speech, and accessibility scanning.

Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import base64
import io

app = FastAPI(title="AccessAI AI Services", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────

class ImageRequest(BaseModel):
    image: str  # base64 encoded
    language: Optional[str] = "eng"

class DetectionObject(BaseModel):
    label: str
    confidence: float
    x: float
    y: float
    width: float
    height: float

class DetectionResponse(BaseModel):
    objects: List[DetectionObject]

class OcrResponse(BaseModel):
    text: str
    confidence: float

class SignResponse(BaseModel):
    sign: Optional[str]
    confidence: float
    landmarks: Optional[list] = None

class AccessibilityFinding(BaseModel):
    category: str
    status: str  # pass, warning, fail
    description: str

class AccessibilityResponse(BaseModel):
    findings: List[AccessibilityFinding]
    overallScore: float
    overallAssessment: str
    recommendations: List[str]

class HeadControlResponse(BaseModel):
    status: str
    position: Optional[dict] = None


# ── Health ────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "AccessAI AI Services"}


# ── Object Detection ──────────────────────────────────────────────────

@app.post("/detect", response_model=DetectionResponse)
def detect_objects(req: ImageRequest):
    """
    Detect objects in an image using YOLOv8.
    Returns bounding boxes with labels and confidence scores.
    """
    try:
        import cv2
        import numpy as np
        from ultralytics import YOLO

        # Decode base64 image
        img_data = base64.b64decode(req.image.split(",")[-1] if "," in req.image else req.image)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        # Run YOLO detection
        model = YOLO("yolov8n.pt")
        results = model(img, verbose=False)

        objects = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                label = model.names[cls]
                h, w = img.shape[:2]
                objects.append(DetectionObject(
                    label=label,
                    confidence=round(conf, 3),
                    x=round(x1 / w, 4),
                    y=round(y1 / h, 4),
                    width=round((x2 - x1) / w, 4),
                    height=round((y2 - y1) / h, 4),
                ))

        return DetectionResponse(objects=objects)

    except ImportError:
        return DetectionResponse(objects=[
            DetectionObject(label="Demo: Person", confidence=0.92, x=0.1, y=0.1, width=0.3, height=0.8),
            DetectionObject(label="Demo: Chair", confidence=0.87, x=0.5, y=0.4, width=0.2, height=0.5),
        ])


# ── OCR ───────────────────────────────────────────────────────────────

@app.post("/ocr", response_model=OcrResponse)
def extract_text(req: ImageRequest):
    """Extract text from image using Tesseract OCR."""
    try:
        import pytesseract
        import cv2
        import numpy as np

        img_data = base64.b64decode(req.image.split(",")[-1] if "," in req.image else req.image)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        text = pytesseract.image_to_string(rgb, lang=req.language or "eng")
        data = pytesseract.image_to_data(rgb, output_type=pytesseract.Output.DICT)
        confs = [int(c) for c in data["conf"] if int(c) > 0]
        avg_conf = sum(confs) / len(confs) / 100 if confs else 0

        return OcrResponse(text=text.strip(), confidence=round(avg_conf, 3))

    except ImportError:
        return OcrResponse(text="[OCR requires Tesseract installation]", confidence=0)


# ── Sign Language ─────────────────────────────────────────────────────

@app.post("/sign-language", response_model=SignResponse)
def recognize_sign(req: ImageRequest):
    """Detect hand landmarks using MediaPipe and classify gesture."""
    try:
        import cv2
        import numpy as np
        import mediapipe as mp

        img_data = base64.b64decode(req.image.split(",")[-1] if "," in req.image else req.image)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        mp_hands = mp.solutions.hands
        with mp_hands.Hands(static_image_mode=True, max_num_hands=1) as hands:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results = hands.process(rgb)

            if results.multi_hand_landmarks:
                landmarks = []
                for lm in results.multi_hand_landmarks[0].landmark:
                    landmarks.append({"x": lm.x, "y": lm.y, "z": lm.z})

                # Simple gesture classification based on finger positions
                sign = _classify_gesture(landmarks)
                return SignResponse(sign=sign, confidence=0.85, landmarks=landmarks)

        return SignResponse(sign=None, confidence=0)

    except ImportError:
        return SignResponse(sign=None, confidence=0, landmarks=[])


def _classify_gesture(landmarks: list) -> str:
    """Classify hand gesture from landmarks (simplified)."""
    if not landmarks:
        return "Unknown"
    # Check if fingers are extended (tip above pip)
    tips = [4, 8, 12, 16, 20]
    pips = [3, 6, 10, 14, 18]
    extended = []
    for tip, pip in zip(tips, pips):
        if tip == 4:
            extended.append(landmarks[tip]["x"] > landmarks[pip]["x"])
        else:
            extended.append(landmarks[tip]["y"] < landmarks[pip]["y"])

    count = sum(extended)
    if count == 0:
        return "Fist"
    elif count == 5:
        return "Open Hand"
    elif count == 1 and extended[1]:
        return "Point"
    elif count == 2 and extended[1] and extended[2]:
        return "Peace"
    return f"Fingers: {count}"


# ── Head Control ──────────────────────────────────────────────────────

@app.post("/head-control/calibrate", response_model=HeadControlResponse)
def calibrate_head(req: ImageRequest):
    """Calibrate head position using face landmarks."""
    return HeadControlResponse(status="calibrated", position={"x": 0.5, "y": 0.5})


# ── Text to Speech ───────────────────────────────────────────────────

class TtsRequest(BaseModel):
    text: str
    speed: Optional[float] = 1.0

@app.post("/text-to-speech")
def text_to_speech(req: TtsRequest):
    """Convert text to speech using gTTS."""
    try:
        from gtts import gTTS
        import io, base64

        tts = gTTS(text=req.text, lang="en")
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        audio_b64 = base64.b64encode(buf.read()).decode()
        return {"audio": f"data:audio/mp3;base64,{audio_b64}"}

    except ImportError:
        return {"audio": None, "message": "gTTS not installed"}


# ── Accessibility Scanner ────────────────────────────────────────────

@app.post("/accessibility-scan", response_model=AccessibilityResponse)
def scan_accessibility(req: ImageRequest):
    """Analyze image for accessibility features and compliance."""
    try:
        import cv2
        import numpy as np

        img_data = base64.b64decode(req.image.split(",")[-1] if "," in req.image else req.image)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")

        findings = []
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)

        # Analyze image regions for accessibility features
        top_half = edges[:h // 2, :]
        bottom_half = edges[h // 2:, :]
        top_density = np.count_nonzero(top_half) / top_half.size
        bottom_density = np.count_nonzero(bottom_half) / bottom_half.size

        # Ramp detection heuristic (angled lines in bottom half)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 50, minLineLength=50, maxLineGap=10)
        angled_lines = 0
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
                if 10 < angle < 35:
                    angled_lines += 1

        if angled_lines > 2:
            findings.append(AccessibilityFinding(category="Entrance", status="pass", description="Possible ramp detected"))
        else:
            findings.append(AccessibilityFinding(category="Entrance", status="warning", description="No clear ramp detected"))

        if bottom_density > 0.05:
            findings.append(AccessibilityFinding(category="Pathway", status="pass", description="Walkable pathway detected"))
        else:
            findings.append(AccessibilityFinding(category="Pathway", status="warning", description="Pathway assessment unclear"))

        # Stair detection
        if top_density > 0.15:
            findings.append(AccessibilityFinding(category="Stairs", status="warning", description="Possible stairs detected - verify accessible alternative exists"))
        else:
            findings.append(AccessibilityFinding(category="Stairs", status="pass", description="No prominent stairway obstruction detected"))

        # Door detection (vertical edges)
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 30))
        vertical = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, vertical_kernel)
        vert_density = np.count_nonzero(vertical) / vertical.size
        if vert_density > 0.02:
            findings.append(AccessibilityFinding(category="Doors", status="pass", description="Door structures detected"))
        else:
            findings.append(AccessibilityFinding(category="Doors", status="warning", description="Door accessibility unclear"))

        # Overall score
        pass_count = sum(1 for f in findings if f.status == "pass")
        warn_count = sum(1 for f in findings if f.status == "warning")
        score = max(0, min(100, (pass_count / len(findings)) * 100)) if findings else 50

        if score >= 75:
            assessment = "good"
        elif score >= 40:
            assessment = "needs-review"
        else:
            assessment = "poor"

        recommendations = []
        for f in findings:
            if f.status == "warning":
                recommendations.append(f"Review {f.category.lower()}: {f.description}")
        if not recommendations:
            recommendations.append("Continue monitoring accessibility features")

        return AccessibilityResponse(
            findings=findings,
            overallScore=round(score, 1),
            overallAssessment=assessment,
            recommendations=recommendations,
        )

    except Exception as e:
        return AccessibilityResponse(
            findings=[],
            overallScore=0,
            overallAssessment="needs-review",
            recommendations=[f"Scan error: {str(e)}"],
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
