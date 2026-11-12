import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveServiceAccount(): {
  credential?: ReturnType<typeof cert> | ReturnType<typeof applicationDefault>;
  projectId?: string;
} {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return {
      projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID,
    };
  }

  // 1. Check inline JSON credential environment variables (recommended for Railway / cloud hosts)
  const rawJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim().startsWith('{')
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : undefined);

  if (rawJson) {
    const parsed = JSON.parse(rawJson) as ServiceAccount & { project_id?: string };
    return {
      credential: cert(parsed),
      projectId:
        process.env.GCLOUD_PROJECT ||
        process.env.FIREBASE_PROJECT_ID ||
        parsed.projectId ||
        parsed.project_id,
    };
  }

  // 2. Check individual Firebase Admin env vars
  const envProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (envProjectId && envClientEmail && envPrivateKey) {
    return {
      credential: cert({
        projectId: envProjectId,
        clientEmail: envClientEmail,
        privateKey: envPrivateKey,
      }),
      projectId: envProjectId,
    };
  }

  // 3. Fallback to file path resolution for local development
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

  return {
    credential: applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID,
  };
}

const resolved = resolveServiceAccount();
const projectId = resolved.projectId;
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  (projectId ? `${projectId}.firebasestorage.app` : undefined);

initializeApp({
  ...(projectId ? { projectId } : {}),
  ...(storageBucket ? { storageBucket } : {}),
  ...(resolved.credential ? { credential: resolved.credential } : {}),
});
export const firestore = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
