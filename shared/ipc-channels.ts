/**
 * IPC channel names shared between the renderer (via preload) and the main process.
 *
 * Using a typed const object instead of string literals prevents typos and
 * makes renaming a channel a single-place change.
 *
 * Naming convention: '<domain>:<action>'
 */
export const IpcChannels = {
  // ── Application ────────────────────────────────────────────────────────────
  APP_GET_STATUS: 'app:get-status',

  // ── Customers (fully implemented) ─────────────────────────────────────────
  CUSTOMERS_LIST:   'customers:list',
  CUSTOMERS_GET:    'customers:get',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',

  // ── Leads ────────────────────────────────────────────────────────────────
  LEADS_LIST:   'leads:list',
  LEADS_GET:    'leads:get',
  LEADS_CREATE: 'leads:create',
  LEADS_UPDATE: 'leads:update',
  LEADS_DELETE: 'leads:delete',

  // ── Installation Sites ───────────────────────────────────────────────────
  INSTALLATION_SITES_LIST_BY_CUSTOMER: 'installation-sites:list-by-customer',
  INSTALLATION_SITES_GET:              'installation-sites:get',
  INSTALLATION_SITES_CREATE:           'installation-sites:create',
  INSTALLATION_SITES_UPDATE:           'installation-sites:update',
  INSTALLATION_SITES_DELETE:           'installation-sites:delete',

  // ── Projects ─────────────────────────────────────────────────────────────
  PROJECTS_LIST:   'projects:list',
  PROJECTS_GET:    'projects:get',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',

  // ── Products ─────────────────────────────────────────────────────────────
  PRODUCTS_LIST:    'products:list',
  PRODUCTS_GET:     'products:get',
  PRODUCTS_CREATE:  'products:create',
  PRODUCTS_UPDATE:  'products:update',
  PRODUCTS_ARCHIVE: 'products:archive',
  PRODUCTS_DELETE:  'products:delete',

  // ── Packages ─────────────────────────────────────────────────────────────
  PACKAGES_LIST:    'packages:list',
  PACKAGES_GET:     'packages:get',
  PACKAGES_CREATE:  'packages:create',
  PACKAGES_UPDATE:  'packages:update',
  PACKAGES_ARCHIVE: 'packages:archive',
  PACKAGES_DELETE:  'packages:delete',

  // ── Surveys ──────────────────────────────────────────────────────────────
  SURVEYS_LIST:      'surveys:list',
  SURVEYS_GET:       'surveys:get',
  SURVEYS_CREATE:    'surveys:create',
  SURVEYS_UPDATE:    'surveys:update',
  SURVEYS_DELETE:    'surveys:delete',

  // ── Quotations ───────────────────────────────────────────────────────────
  QUOTATIONS_LIST:   'quotations:list',
  QUOTATIONS_GET:    'quotations:get',
  QUOTATIONS_CREATE: 'quotations:create',
  QUOTATIONS_UPDATE: 'quotations:update',
  QUOTATIONS_DELETE: 'quotations:delete',
  QUOTATIONS_GENERATE_PDF: 'quotations:generate-pdf',

  // ── Finance ──────────────────────────────────────────────────────────────
  INVOICES_LIST:     'invoices:list',
  INVOICES_GET:      'invoices:get',
  INVOICES_CREATE:   'invoices:create',
  INVOICES_UPDATE:   'invoices:update',
  INVOICES_DELETE:   'invoices:delete',

  PAYMENTS_LIST:     'payments:list',
  PAYMENTS_GET:      'payments:get',
  PAYMENTS_CREATE:   'payments:create',
  PAYMENTS_UPDATE:   'payments:update',
  PAYMENTS_DELETE:   'payments:delete',

  // ── Dashboard ────────────────────────────────────────────────────────────
  DASHBOARD_METRICS: 'dashboard:metrics',

  // ── Settings ─────────────────────────────────────────────────────────────
  SETTINGS_GET_ALL:              'settings:get-all',
  SETTINGS_UPDATE_PROFILE:       'settings:update-profile',
  SETTINGS_UPDATE_BUSINESS:      'settings:update-business',
  SETTINGS_UPDATE_BACKUP_CONFIG: 'settings:update-backup-config',
  SETTINGS_GET_IC_PRICING:       'settings:get-ic-pricing',
  SETTINGS_UPDATE_IC_PRICING:    'settings:update-ic-pricing',

  // ── Storage Management ───────────────────────────────────────────────────
  STORAGE_GET_INFO:          'storage:get-info',
  STORAGE_SELECT_DIRECTORY:  'storage:select-directory',
  STORAGE_VALIDATE_PATH:     'storage:validate-path',
  STORAGE_COMPLETE_SETUP:    'storage:complete-setup',
  STORAGE_MIGRATE:           'storage:migrate',
  STORAGE_LOCATE_EXISTING:   'storage:locate-existing',
  STORAGE_RETRY_CONNECTION:  'storage:retry-connection',

  // ── Backups & Restore ────────────────────────────────────────────────────
  BACKUP_CREATE:         'backup:create',
  BACKUP_LIST:           'backup:list',
  BACKUP_SELECT_ARCHIVE: 'backup:select-archive',
  BACKUP_VALIDATE:       'backup:validate',
  BACKUP_RESTORE:        'backup:restore',

  // ── Business Categories ───────────────────────────────────────────────────
  CATEGORIES_LIST:        'categories:list',
  CATEGORIES_LIST_ACTIVE: 'categories:list-active',

  // ── Advances & Allocation ────────────────────────────────────────────────
  RECEIPTS_LIST:               'receipts:list',
  RECEIPTS_GET:                'receipts:get',
  RECEIPTS_CREATE:             'receipts:create',
  RECEIPTS_ALLOCATE:           'receipts:allocate',
  RECEIPTS_UNALLOCATED:        'receipts:unallocated',
  OUTSTANDING_BALANCES:        'finance:outstanding-balances',
  OUTSTANDING_BY_CUSTOMER:     'finance:outstanding-by-customer',

  // ── Quotation Milestones ────────────────────────────────────────────────
  MILESTONES_LIST:   'milestones:list',
  MILESTONES_UPSERT: 'milestones:upsert',

  // ── CRM Documents ─────────────────────────────────────────────────────
  DOCUMENTS_LIST:   'documents:list',
  DOCUMENTS_GET:    'documents:get',
  DOCUMENTS_CREATE: 'documents:create',
  DOCUMENTS_UPDATE: 'documents:update',
  DOCUMENTS_DELETE: 'documents:delete',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
