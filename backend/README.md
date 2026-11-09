# AccessAI Backend

## Environment Variables

Create a `.env` file in this directory with:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/accessai
JWT_SECRET=your-secure-random-secret-key-here
FRONTEND_URL=http://localhost:5173
PYTHON_AI_SERVICE_URL=http://localhost:8000
```

## Setup

```bash
npm install
cp .env.example .env   # then edit with your values
npm run dev
```
