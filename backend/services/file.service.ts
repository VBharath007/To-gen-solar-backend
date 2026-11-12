import { mkdir } from 'fs/promises';

/**
 * Ensures that an array of directory paths exists, creating them and their parents if necessary.
 */
export async function ensureDirectories(paths: string[]): Promise<void> {
  for (const p of paths) {
    await mkdir(p, { recursive: true });
  }
}
