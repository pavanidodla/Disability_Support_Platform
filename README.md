# AccessAI – Unified AI-Powered Accessibility Platform

**One Platform. Multiple Ways to Access the World.**

AccessAI combines AI-powered accessibility tools into one unified platform, supporting users with visual, hearing, and mobility impairments.

---

## Architecture

```
AccessAI/
├── frontend/          # React + Vite + TypeScript + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── components/    # AppLayout, AccessibilityOnboarding, UI components
│   │   ├── convex/        # Convex backend functions (schema, queries, mutations)
│   │   ├── hooks/         # useCamera, useSpeech, useSpeechRecognition
│   │   ├── pages/         # Landing, Dashboard, 7 feature pages
│   │   └── lib/           # Utilities
│   └── package.json
│
├── backend/           # Node.js + Express + MongoDB
│   ├── controllers/       # Auth, detection, OCR, sign language, scanner, history
│   ├── routes/            # REST API routes
│   ├── models/            # Mongoose schemas
│   ├── middleware/         # JWT authentication
│   ├── services/          # MongoDB connection
│   └── server.js
│
├── ai-services/       # Python + FastAPI
│   ├── main.py            # All AI endpoints (YOLO, OCR, MediaPipe, gTTS)
│   ├── requirements.txt
│   └── [module stubs]/    # object_detection, ocr, sign_language, etc.
│
└── README.md
```

## Features

| Feature | Description | Technology |
|---------|-------------|------------|
| **Object Detection** | Live camera with bounding boxes and voice guidance | YOLOv8 / Browser API |
| **Read Aloud** | Camera/file OCR with text-to-speech playback | Tesseract.js / Web Speech API |
| **Sign Language** | Hand landmark detection and gesture recognition | MediaPipe Hands |
| **Head Control** | Face position estimation for cursor control | Skin-tone face tracking |
| **Voice Commands** | Hands-free navigation via speech | Web Speech API |
| **Accessibility Scanner** | Building accessibility analysis and reports | Computer Vision |
| **Unified Dashboard** | Stats, recent activity, quick actions | React + Convex |

## Quick Start

### Frontend (Freebuff Cloud)

The frontend runs on Freebuff automatically. The Convex backend is configured via the Keys/API keys tab.

### Local Development

#### Prerequisites

- [Node.js](https://nodejs.org) v18+
- [npm](https://npmjs.com) (comes with Node.js)
- [Python 3.10+](https://python.org)
- [MongoDB](https://mongodb.com) (local or Docker)
- [Git](https://git-scm.com)

#### 1. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

#### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # Edit with your MongoDB URI and JWT secret
npm run dev
# Runs at http://localhost:5000
```

#### 3. Python AI Services

```bash
cd ai-services
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Runs at http://localhost:8000
```

#### 4. MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 mongo:7
```

## Backend API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register user (name, email, password) |
| `/api/auth/login` | POST | Login, returns JWT |
| `/api/auth/profile` | GET | Get user profile |
| `/api/object-detection` | POST | Detect objects in image |
| `/api/ocr` | POST | Extract text from image |
| `/api/sign-language/recognize` | POST | Recognize sign gesture |
| `/api/sign-language/session` | POST | Save sign session |
| `/api/head-control/calibrate` | POST | Calibrate head position |
| `/api/voice-command/parse` | POST | Parse voice command |
| `/api/accessibility-scan` | POST | Scan building for accessibility |
| `/api/accessibility-scan` | GET | Get saved scans |
| `/api/history` | GET | Get activity history |
| `/api/history/stats` | GET | Get usage statistics |

## AI Service API (Python)

| Endpoint | Description |
|----------|-------------|
| `POST /detect` | YOLOv8 object detection |
| `POST /ocr` | Tesseract OCR text extraction |
| `POST /sign-language` | MediaPipe hand gesture recognition |
| `POST /text-to-speech` | gTTS text-to-speech |
| `POST /accessibility-scan` | Computer vision accessibility analysis |
| `POST /head-control/calibrate` | Head position calibration |

## Environment Variables

### Backend (`backend/.env`)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/accessai
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
PYTHON_AI_SERVICE_URL=http://localhost:8000
```

### Frontend (`frontend/.env`)
```
VITE_API_URL=http://localhost:5000
VITE_CONVEX_URL=your-convex-url
```

## Browser Requirements

- **Chrome**, **Edge**, or **Safari** recommended
- Camera and microphone permissions required for AI features
- HTTPS required in production (localhost works for dev)

## Limitations

- **Head Control**: Browser security prevents OS-level cursor control; implements browser-compatible pointer simulation
- **Sign Language**: Gesture classification is simplified; a trained model can be swapped in via the modular classifier
- **Object Detection**: YOLOv8n (nano) model is used for speed; larger models improve accuracy
- **Accessibility Scanner**: AI-based assessment, not legal compliance certification

## License

MIT
