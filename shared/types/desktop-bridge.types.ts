import type { ApiResponse } from './api-response.types';
import type { Lead, CreateLeadDto, UpdateLeadDto } from './lead.types';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from './customer.types';
import type { InstallationSite, CreateInstallationSiteDto, UpdateInstallationSiteDto } from './installation-site.types';
import type { Project, CreateProjectDto, UpdateProjectDto } from './project.types';
import type { Product, CreateProductDto, UpdateProductDto } from './product.types';
import type { Package, CreatePackageDto, UpdatePackageDto } from './package.types';
import type { SiteSurvey, CreateSiteSurveyDto, UpdateSiteSurveyDto } from './survey.types';
import type { Quotation, CreateQuotationDto, UpdateQuotationDto } from './quotation.types';
import type { Invoice, CreateInvoiceDto, UpdateInvoiceDto, Payment, CreatePaymentDto, UpdatePaymentDto } from './finance.types';
import type {
  UserProfile,
  BusinessInfo,
  BackupConfig,
  StorageInfo,
  AllSettingsResponse,
  DirectoryValidationResult,
  BackupItem,
  BackupManifest,
  IcPricingConfig,
} from './settings.types';

/**
 * Type of the `window.desktop` object exposed by the preload script.
 *
 * Defined here (not in electron/preload.ts) so both the preload and the
 * renderer's desktop service can import it without crossing bundle boundaries.
 *
 * When adding a new module:
 * 1. Add its method signatures to this interface.
 * 2. Implement the matching `ipcRenderer.invoke` calls in electron/preload.ts.
 * 3. Register the `ipcMain.handle` in the appropriate handler file.
 */
export interface DesktopBridge {
  app: {
    /** Returns the app version and DB connection status. */
    getStatus(): Promise<
      ApiResponse<{
        version: string;
        dbConnected: boolean;
        needsSetup?: boolean;
        storageMissing?: boolean;
        missingPath?: string;
        userDataPath?: string;
      }>
    >;
  };

  leads: {
    list(): Promise<ApiResponse<Lead[]>>;
    get(id: number): Promise<ApiResponse<Lead>>;
    create(dto: CreateLeadDto): Promise<ApiResponse<Lead>>;
    update(dto: UpdateLeadDto): Promise<ApiResponse<Lead>>;
    delete(id: number): Promise<ApiResponse<{ deleted: boolean }>>;
  };

  customers: {
    list(): Promise<ApiResponse<Customer[]>>;
    get(id: number): Promise<ApiResponse<Customer>>;
    create(dto: CreateCustomerDto): Promise<ApiResponse<Customer>>;
    update(dto: UpdateCustomerDto): Promise<ApiResponse<Customer>>;
    delete(id: number): Promise<ApiResponse<{ deleted: boolean }>>;
  };

  installationSites: {
    listByCustomer(customerId: number): Promise<ApiResponse<InstallationSite[]>>;
    get(id: number): Promise<ApiResponse<InstallationSite>>;
    create(dto: CreateInstallationSiteDto): Promise<ApiResponse<InstallationSite>>;
    update(dto: UpdateInstallationSiteDto): Promise<ApiResponse<InstallationSite>>;
    delete(id: number): Promise<ApiResponse<{ deleted: boolean }>>;
  };

  projects: {
    list(): Promise<ApiResponse<Project[]>>;
    get(id: number): Promise<ApiResponse<Project>>;
    create(dto: CreateProjectDto): Promise<ApiResponse<Project>>;
    update(dto: UpdateProjectDto): Promise<ApiResponse<Project>>;
    delete(id: number): Promise<ApiResponse<{ deleted: boolean }>>;
  };

  products: {
    list(includeArchived?: boolean): Promise<ApiResponse<Product[]>>;
    get(id: number): Promise<ApiResponse<Product>>;
    create(dto: CreateProductDto): Promise<ApiResponse<Product>>;
    update(dto: UpdateProductDto): Promise<ApiResponse<Product>>;
    archive(id: number, archive: boolean): Promise<ApiResponse<{ archived: boolean }>>;
    delete(id: number): Promise<ApiResponse<void>>;
  };

  packages: {
    list(includeArchived?: boolean): Promise<ApiResponse<Package[]>>;
    get(id: number): Promise<ApiResponse<Package>>;
    create(dto: CreatePackageDto): Promise<ApiResponse<Package>>;
    update(dto: UpdatePackageDto): Promise<ApiResponse<Package>>;
    archive(id: number, archive: boolean): Promise<ApiResponse<{ archived: boolean }>>;
    delete(id: number): Promise<ApiResponse<{ deleted: boolean }>>;
  };

  surveys: {
    list(): Promise<ApiResponse<SiteSurvey[]>>;
    get(id: number): Promise<ApiResponse<SiteSurvey>>;
    create(dto: CreateSiteSurveyDto): Promise<ApiResponse<SiteSurvey>>;
    update(dto: UpdateSiteSurveyDto): Promise<ApiResponse<SiteSurvey>>;
    delete(id: number): Promise<ApiResponse<void>>;
  };

  quotations: {
    list(): Promise<ApiResponse<Quotation[]>>;
    get(id: number): Promise<ApiResponse<Quotation>>;
    create(dto: CreateQuotationDto): Promise<ApiResponse<Quotation>>;
    update(dto: UpdateQuotationDto): Promise<ApiResponse<Quotation>>;
    delete(id: number): Promise<ApiResponse<{ success: boolean }>>;
    generatePdf?(payload: { pagesHtml: string[]; filename: string }): Promise<ApiResponse<{ filePath?: string; opened?: boolean }>>;
  };

  invoices: {
    list(): Promise<ApiResponse<Invoice[]>>;
    get(id: number): Promise<ApiResponse<Invoice>>;
    create(dto: CreateInvoiceDto): Promise<ApiResponse<Invoice>>;
    update(dto: UpdateInvoiceDto): Promise<ApiResponse<Invoice>>;
    delete(id: number): Promise<ApiResponse<void>>;
  };

  payments: {
    list(): Promise<ApiResponse<Payment[]>>;
    get(id: number): Promise<ApiResponse<Payment>>;
    create(dto: CreatePaymentDto): Promise<ApiResponse<Payment>>;
    update(dto: UpdatePaymentDto): Promise<ApiResponse<Payment>>;
    delete(id: number): Promise<ApiResponse<{ success: boolean }>>;
  };

  receipts: {
    list(): Promise<ApiResponse<any[]>>;
    get(id: number): Promise<ApiResponse<any>>;
    create(dto: any): Promise<ApiResponse<any>>;
    allocate(dto: any): Promise<ApiResponse<any>>;
    listUnallocated(customerId?: number): Promise<ApiResponse<any[]>>;
  };

  finance: {
    getOutstandingBalances(): Promise<ApiResponse<any[]>>;
    getOutstandingByCustomer(customerId: number): Promise<ApiResponse<any[]>>;
  };

  categories: {
    list(): Promise<ApiResponse<any[]>>;
    listActive(): Promise<ApiResponse<any[]>>;
  };

  dashboard: {
    getMetrics(): Promise<ApiResponse<import('./dashboard.types').DashboardMetrics>>;
  };

  settings: {
    getAll(): Promise<ApiResponse<AllSettingsResponse>>;
    updateProfile(dto: UserProfile): Promise<ApiResponse<UserProfile>>;
    updateBusiness(dto: BusinessInfo): Promise<ApiResponse<BusinessInfo>>;
    updateBackupConfig(dto: BackupConfig): Promise<ApiResponse<BackupConfig>>;
    getIcPricing(): Promise<ApiResponse<IcPricingConfig>>;
    updateIcPricing(dto: IcPricingConfig): Promise<ApiResponse<IcPricingConfig>>;
  };

  storage: {
    getInfo(): Promise<ApiResponse<StorageInfo>>;
    selectDirectory(): Promise<ApiResponse<DirectoryValidationResult | null>>;
    validatePath(path: string): Promise<ApiResponse<DirectoryValidationResult>>;
    completeSetup(chosenPath: string, mode: 'new' | 'existing'): Promise<ApiResponse<{ success: boolean; dataRoot: string }>>;
    migrate(destinationParentPath: string): Promise<ApiResponse<{ success: boolean; newDataRoot: string; recoveryCopyPath: string }>>;
    locateExisting(targetDir: string): Promise<ApiResponse<{ success: boolean; dataRoot: string }>>;
    retryConnection(): Promise<ApiResponse<{ connected: boolean; message?: string }>>;
  };

  backup: {
    create(customDestinationPath?: string): Promise<ApiResponse<BackupItem>>;
    list(): Promise<ApiResponse<BackupItem[]>>;
    selectArchive(): Promise<ApiResponse<{ filePath: string; manifest?: BackupManifest } | null>>;
    validate(filePath: string): Promise<ApiResponse<{ isValid: boolean; manifest?: BackupManifest; error?: string }>>;
    restore(filePath: string): Promise<ApiResponse<{ success: boolean; recoveryBackupPath: string }>>;
  };
}

