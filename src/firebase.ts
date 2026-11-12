import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure GOOGLE_APPLICATION_CREDENTIALS resolves to an existing file
const rawCredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!rawCredPath || !fs.existsSync(rawCredPath)) {
  const candidates = [
    path.resolve(__dirname, '../service-account-admin.json'),
    path.resolve(process.cwd(), 'service-account-admin.json'),
    path.resolve(process.cwd(), 'server/service-account-admin.json'),
    rawCredPath ? path.resolve(__dirname, '..', rawCredPath) : null,
    rawCredPath ? path.resolve(process.cwd(), rawCredPath) : null,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = candidate;
      break;
    }
  }
} else if (!path.isAbsolute(rawCredPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.cwd(), rawCredPath);
}

initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  ...(!process.env.FIRESTORE_EMULATOR_HOST ? { credential: applicationDefault() } : {}),
});
export const firestore = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
