# ToGen Solar Backend (`togen-mobile-api`)

Node.js + Express + TypeScript backend API for ToGen Solar CRM with Firebase Authentication/Firestore/Storage, domain service logic (`sql.js`), and Playwright-based server PDF rendering.

## Prerequisites

- Node.js 22 LTS or newer
- Firebase project with Authentication, Firestore, and Cloud Storage enabled

## Local Setup

```bash
npm ci
cp .env.example .env
```

Update `.env` with your Firebase settings:

- `PORT=8080`
- `GCLOUD_PROJECT=your-firebase-project-id`
- `FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app`
- `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-admin.json`
- `WEB_ORIGIN=*` (or comma-separated origins)

## Build & Run

```bash
# Type check
npm run check

# Run unit/integration tests
npm test

# Install Chromium for PDF generation & build the PDF browser bundle (dist/pdf-browser.js)
npx playwright install --with-deps chromium
npm run pdf:build

# Start server
npm start
```

For development with hot reload:

```bash
npm run dev
```

## Docker / Railway Deployment

The included `Dockerfile` installs dependencies, installs Playwright Chromium, runs `npm run check && npm run pdf:build`, exposes port `8080`, and runs `npm start`.

When deploying on Railway (or similar cloud hosts without `service-account-admin.json`), configure these environment variables:

- `GCLOUD_PROJECT`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (paste your Firebase Admin service-account JSON content)
- `WEB_ORIGIN=*`

