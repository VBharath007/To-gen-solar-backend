/** Internal app name used for Electron's userData path and app.setName(). */
export const APP_NAME = 'ToGenSolarCRM';

/** Human-readable display name shown in title bars, installers, etc. */
export const APP_DISPLAY_NAME = 'ToGen Solar CRM';

/** Scaffold version – bump with each release. */
export const APP_VERSION = '0.1.0';

/** Sub-directory names inside Electron's resolved userData folder. */
export const DATA_SUBDIRS = {
  DATABASE:    'database',
  ATTACHMENTS: 'attachments',
  EXPORTS:     'exports',
  BACKUPS:     'backups',
  LOGS:        'logs',
} as const;

/** SQLite database filename inside DATA_SUBDIRS.DATABASE. */
export const DB_FILENAME = 'crm.sqlite';
