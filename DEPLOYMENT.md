# CreditIQ — Deployment Guide (100% Free)

## Architecture

```
Browser (React SPA)
  ↕ Firebase Auth + Firestore (free)
  ↕ FastAPI on Render.com (free)
```

---

## Step 1 — Firebase Setup

1. Go to https://console.firebase.google.com
2. **Create project** → name: `creditiq` → disable Google Analytics → Create
3. **Authentication** → Get Started → Email/Password → **Enable** → Save
4. **Firestore Database** → Create Database → **Start in test mode** → choose nearest region → Enable
5. Click the **`</>`** Web icon → register app name `creditiq-web` → **copy the firebaseConfig**

### Firestore Security Rules (paste in Firestore → Rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /applications/{docId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null &&
        (resource.data.userId == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow update, delete: if false;
    }
    match /meta/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## Step 2 — Backend on Render.com (free)

1. Push this repo to GitHub
2. Go to https://render.com → New → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free
5. Click **Deploy**
6. Copy the URL (e.g. `https://creditiq-api.onrender.com`)

> **Note:** Free Render instances sleep after 15 min of inactivity. First request after sleep takes ~30 sec.

---

## Step 3 — Frontend on Vercel (free)

1. Go to https://vercel.com → New Project → Import your GitHub repo
2. **Root Directory:** `creditwise-dashboard-main`
3. **Framework Preset:** Vite
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Add **Environment Variables** (from your Firebase config + Render URL):

```
VITE_FIREBASE_API_KEY           = AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN       = your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID        = your-project-id
VITE_FIREBASE_STORAGE_BUCKET    = your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = 123456789
VITE_FIREBASE_APP_ID            = 1:123...:web:abc...
VITE_API_URL                    = https://creditiq-api.onrender.com
```

7. Click **Deploy**

---

## Step 4 — Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### Frontend
```bash
cd creditwise-dashboard-main
cp .env.example .env.local
# Fill in .env.local with your Firebase config and VITE_API_URL=http://localhost:8000
npm install
npm run dev
# → http://localhost:5173
```

---

## First Login

1. Go to `/register` → create your account → **first user automatically gets Admin role**
2. Admin users see the **Admin Panel** in the sidebar
3. All subsequent users are regular users

---

## Tech Stack Summary

| Layer | Technology | Free Tier |
|-------|-----------|-----------|
| Frontend | React + TanStack Router + Tailwind | Vercel |
| Auth | Firebase Authentication | Spark plan |
| Database | Cloud Firestore | Spark plan (1 GiB) |
| ML Backend | FastAPI + scikit-learn (Random Forest) | Render.com |
| ML Model | Trained on synthetic Indian financial data | In-process |
| Explainability | Feature importances + rule-based | Built-in |
