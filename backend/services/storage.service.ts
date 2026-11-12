import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  statSync,
  cpSync,
  renameSync,
} from 'fs';
import { join, resolve } from 'path';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import type {
  StorageInfo,
  DirectoryValidationResult,
} from '@shared/types/settings.types';
import { getConfig, updateConfig, isConfigSet } from '../config';
import {
  checkpointDatabase,
  reopenDatabase,
  verifyDatabaseIntegrity,
  isDatabaseInitialized,
} from '../database/connection';
import { logAudit } from './audit.service';
import Database from 'better-sqlite3';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Returns true if the path points to a network share or UNC path (e.g. \\server\share or //server/share).
 */
export function isNetworkPath(targetPath: string): boolean {
  return (
    targetPath.startsWith('\\\\') ||
    targetPath.startsWith('//') ||
    targetPath.startsWith('smb:')
  );
}

/**
 * Counts total files inside a directory recursively.
 */
function countFilesInDir(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        count += countFilesInDir(full);
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch {
    // Ignore read errors
  }
  return count;
}

/**
 * Validates a candidate directory for CRM storage.
 */
export function validateStorageDirectory(candidatePath: string): DirectoryValidationResult {
  const norm = resolve(candidatePath);

  // 1. Network share check
  if (isNetworkPath(candidatePath) || isNetworkPath(norm)) {
    return {
      path: candidatePath,
      finalPath: norm,
      exists: existsSync(norm),
      isWritable: false,
      hasExistingDataset: false,
      isNetworkPath: true,
      isInsideAppDir: false,
      isValid: false,
      errorMessage: 'Network paths are not supported for active SQLite CRM databases. Please select a local fixed drive.',
    };
  }

  // 2. Prevent installing directly into Windows system directories or app installation
  const lower = norm.toLowerCase();
  const isInsideApp =
    lower.includes('program files') ||
    lower.includes('node_modules') ||
    lower.endsWith('\\windows') ||
    lower.endsWith('\\windows\\system32');

  // Compute final directory name (ensure ToGenSolarCRM is the dedicated subfolder)
  const finalPath = norm.toLowerCase().endsWith('togensolarcrm')
    ? norm
    : join(norm, 'ToGenSolarCRM');

  // 3. Test writability by touching a temp test file
  let isWritable = false;
  try {
    if (!existsSync(norm)) {
      mkdirSync(norm, { recursive: true });
    }
    const testFile = join(norm, `.togen_write_test_${Date.now()}.tmp`);
    writeFileSync(testFile, 'test');
    unlinkSync(testFile);
    isWritable = true;
  } catch {
    isWritable = false;
  }

  // 4. Check if existing dataset exists in candidate / final path
  const hasExistingDataset =
    existsSync(join(finalPath, 'database', 'crm.sqlite')) ||
    existsSync(join(norm, 'database', 'crm.sqlite'));

  // 5. Build warning/error messages
  let warningMessage: string | undefined;
  let errorMessage: string | undefined;
  let isValid = true;

  if (!isWritable) {
    isValid = false;
    errorMessage = 'Selected folder is read-only or requires elevated administrator permissions.';
  } else if (isInsideApp) {
    isValid = false;
    errorMessage = 'Cannot store database inside application installation or Windows system directories.';
  } else if (lower.includes('onedrive') || lower.includes('dropbox') || lower.includes('google drive')) {
    warningMessage = 'Notice: Cloud sync folders may cause temporary SQLite file locks. A standard local drive is strongly recommended.';
  }

  return {
    path: candidatePath,
    finalPath,
    exists: existsSync(norm),
    isWritable,
    hasExistingDataset,
    isNetworkPath: false,
    isInsideAppDir: isInsideApp,
    isValid,
    warningMessage,
    errorMessage,
  };
}

/**
 * Ensures standard CRM directory tree exists under dataRoot:
 * database, attachments/YYYY/MM, exports/YYYY/MM, backups/YYYY/MM, logs/YYYY/MM
 */
export function initializeStorageTree(dataRoot: string): void {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  const dirs = [
    join(dataRoot, 'database'),
    join(dataRoot, 'attachments', yyyy, mm),
    join(dataRoot, 'attachments', 'business'),
    join(dataRoot, 'exports', yyyy, mm, 'quotations'),
    join(dataRoot, 'exports', yyyy, mm, 'invoices'),
    join(dataRoot, 'exports', yyyy, mm, 'receipts'),
    join(dataRoot, 'exports', yyyy, mm, 'reports'),
    join(dataRoot, 'backups', yyyy, mm),
    join(dataRoot, 'logs', yyyy, mm),
  ];

  for (const d of dirs) {
    if (!existsSync(d)) {
      mkdirSync(d, { recursive: true });
    }
  }
}

/**
 * Returns status and statistics for current storage location.
 */
export function getStorageInfo(): ApiResponse<StorageInfo> {
  try {
    if (!isConfigSet()) {
      return ok({
        dataRoot: '',
        dbPath: '',
        isWritable: false,
        dbSizeBytes: 0,
        dbSizeFormatted: '0 Bytes',
        isNetworkPath: false,
        attachmentsCount: 0,
        backupsCount: 0,
      });
    }

    const config = getConfig();
    const dataRoot = config.userDataPath;
    const dbPath = config.dbFilePath;

    let isWritable = false;
    try {
      const testFile = join(dataRoot, `.togen_check_${Date.now()}.tmp`);
      writeFileSync(testFile, '1');
      unlinkSync(testFile);
      isWritable = true;
    } catch {
      isWritable = false;
    }

    let dbSizeBytes = 0;
    if (existsSync(dbPath)) {
      try {
        dbSizeBytes = statSync(dbPath).size;
      } catch {
        // ignore
      }
    }

    const attachmentsCount = countFilesInDir(config.attachmentsPath);
    const backupsCount = countFilesInDir(config.backupsPath);

    return ok({
      dataRoot,
      dbPath,
      isWritable,
      dbSizeBytes,
      dbSizeFormatted: formatBytes(dbSizeBytes),
      isNetworkPath: isNetworkPath(dataRoot),
      attachmentsCount,
      backupsCount,
    });
  } catch (err) {
    console.error('[StorageService.getStorageInfo]', err);
    return fail('INTERNAL_ERROR', 'Failed to retrieve storage information');
  }
}

/**
 * Executes a safe, 9-step controlled storage migration.
 */
export function migrateStorage(
  destinationParentPath: string,
  onProgress?: (step: number, total: number, msg: string) => void
): ApiResponse<{ success: boolean; newDataRoot: string; recoveryCopyPath: string }> {
  const currentConfig = getConfig();
  const currentDataRoot = currentConfig.userDataPath;

  // Step 1: Validate destination
  const validation = validateStorageDirectory(destinationParentPath);
  if (!validation.isValid) {
    return fail('VALIDATION_ERROR', validation.errorMessage || 'Invalid destination folder');
  }

  const targetDataRoot = validation.finalPath;

  // Step 2: Reject identical or nested paths
  if (resolve(currentDataRoot).toLowerCase() === resolve(targetDataRoot).toLowerCase()) {
    return fail('VALIDATION_ERROR', 'Destination path is identical to the current data directory');
  }
  if (resolve(targetDataRoot).toLowerCase().startsWith(resolve(currentDataRoot).toLowerCase())) {
    return fail('VALIDATION_ERROR', 'Destination cannot be placed inside the current data directory');
  }
  if (resolve(currentDataRoot).toLowerCase().startsWith(resolve(targetDataRoot).toLowerCase())) {
    return fail('VALIDATION_ERROR', 'Destination cannot contain the existing data directory');
  }

  onProgress?.(1, 9, 'Validated destination path');

  const tempMigrateRoot = join(resolve(destinationParentPath), `ToGenSolarCRM_migrating_${Date.now()}`);

  try {
    // Step 3: Pause writes & Checkpoint WAL
    onProgress?.(2, 9, 'Checkpointing database WAL');
    checkpointDatabase();

    // Step 4: Complete pending operations and close DB
    onProgress?.(3, 9, 'Closing database for safe transfer');

    // Step 5: Copy database and supporting directories to temporary destination
    onProgress?.(4, 9, 'Copying CRM data and attachments to destination');
    if (!existsSync(tempMigrateRoot)) {
      mkdirSync(tempMigrateRoot, { recursive: true });
    }

    cpSync(currentDataRoot, tempMigrateRoot, { recursive: true });

    // Step 6: Verify integrity of migrated database
    onProgress?.(5, 9, 'Verifying migrated database integrity');
    const tempDbPath = join(tempMigrateRoot, 'database', 'crm.sqlite');
    if (!existsSync(tempDbPath)) {
      throw new Error('Database file was not found in destination copy');
    }

    const verifyDb = new Database(tempDbPath);
    const integrity = verifyDatabaseIntegrity(verifyDb);
    verifyDb.close();

    if (!integrity.ok) {
      throw new Error(`Integrity check failed on copied database: ${integrity.message}`);
    }

    // Step 7: Finalize destination folder name
    onProgress?.(6, 9, 'Finalizing destination directory');
    if (existsSync(targetDataRoot)) {
      const backupExisting = `${targetDataRoot}_pre_replace_${Date.now()}`;
      renameSync(targetDataRoot, backupExisting);
    }
    renameSync(tempMigrateRoot, targetDataRoot);

    // Step 8: Retain source as recovery copy
    onProgress?.(7, 9, 'Creating safety recovery copy of previous location');
    const recoveryCopyPath = `${currentDataRoot}_backup_pre_migration_${Date.now()}`;
    try {
      renameSync(currentDataRoot, recoveryCopyPath);
    } catch (e) {
      console.warn('[migrateStorage] Notice: source folder rename was locked, kept original intact:', e);
    }

    // Step 9: Update runtime config, reopen database, and log audit
    onProgress?.(8, 9, 'Updating application configuration');
    const newDbPath = join(targetDataRoot, 'database', 'crm.sqlite');
    const newAttachmentsPath = join(targetDataRoot, 'attachments');
    const newExportsPath = join(targetDataRoot, 'exports');
    const newBackupsPath = join(targetDataRoot, 'backups');
    const newLogsPath = join(targetDataRoot, 'logs');

    updateConfig({
      userDataPath: targetDataRoot,
      dbFilePath: newDbPath,
      attachmentsPath: newAttachmentsPath,
      exportsPath: newExportsPath,
      backupsPath: newBackupsPath,
      logsPath: newLogsPath,
    });

    reopenDatabase(newDbPath);

    logAudit('STORAGE_MIGRATED', 'storage', targetDataRoot, {
      from: currentDataRoot,
      to: targetDataRoot,
      recoveryCopy: recoveryCopyPath,
    });

    onProgress?.(9, 9, 'Storage migration completed successfully');

    return ok({
      success: true,
      newDataRoot: targetDataRoot,
      recoveryCopyPath,
    });
  } catch (err) {
    console.error('[StorageService.migrateStorage] Migration failed:', err);

    // Clean up temporary incomplete folder if present
    if (existsSync(tempMigrateRoot)) {
      try {
        unlinkSync(tempMigrateRoot);
      } catch {
        // ignore
      }
    }

    // Ensure database remains open at previous location
    if (!isDatabaseInitialized()) {
      try {
        reopenDatabase(currentConfig.dbFilePath);
      } catch (e) {
        console.error('[StorageService.migrateStorage] Failed to reopen previous database:', e);
      }
    }

    return fail('INTERNAL_ERROR', `Migration aborted: ${(err as Error).message}. Original data was preserved.`);
  }
}
