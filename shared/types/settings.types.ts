export interface UserProfile {
  displayName: string;
  email: string;
  phoneNumber: string;
}

export interface BusinessInfo {
  businessName: string;
  businessEmail: string;
  primaryPhone: string;
  alternatePhone: string;
  address: string;
  gstin: string;
  logoPath?: string;
  logoBase64?: string;
}

export interface BackupConfig {
  autoBackupEnabled: boolean;
  intervalHours: number; // e.g. 6, 12, 24, 48
  customBackupPath?: string;
  lastBackupTime?: string;
  nextBackupTime?: string;
  lastStatus?: 'success' | 'failed' | 'in-progress';
  lastError?: string;
}

export interface StorageInfo {
  dataRoot: string;
  dbPath: string;
  isWritable: boolean;
  freeSpaceBytes?: number;
  freeSpaceFormatted?: string;
  dbSizeBytes?: number;
  dbSizeFormatted?: string;
  isNetworkPath: boolean;
  attachmentsCount: number;
  backupsCount: number;
}

export interface DirectoryValidationResult {
  path: string;
  finalPath: string;
  exists: boolean;
  isWritable: boolean;
  freeSpaceBytes?: number;
  freeSpaceFormatted?: string;
  hasExistingDataset: boolean;
  isNetworkPath: boolean;
  isInsideAppDir: boolean;
  isValid: boolean;
  warningMessage?: string;
  errorMessage?: string;
}

export interface BackupManifest {
  version: string;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  dbChecksum: string;
  businessSnapshot?: BusinessInfo;
  filesCount: number;
  totalSizeBytes: number;
}

export interface BackupItem {
  filename: string;
  filepath: string;
  createdAt: string;
  sizeBytes: number;
  sizeFormatted: string;
  manifest?: BackupManifest;
  isValid: boolean;
}

export interface MigrationProgress {
  step: number;
  totalSteps: number;
  status: string;
}

export interface IcPricingSlab {
  minKw: number;
  maxKw: number;
  ratePerKw: number; // in Rupees
}

export interface IcPricingConfig {
  enabled: boolean;
  pricingModel: 'per_kw' | 'slabs';
  ratePerKw: number; // in Rupees
  slabs: IcPricingSlab[];
}

export const DEFAULT_IC_PRICING: IcPricingConfig = {
  enabled: true,
  pricingModel: 'per_kw',
  ratePerKw: 2500,
  slabs: [
    { minKw: 1, maxKw: 10, ratePerKw: 3000 },
    { minKw: 10.01, maxKw: 50, ratePerKw: 2500 },
    { minKw: 50.01, maxKw: 100, ratePerKw: 2000 },
    { minKw: 100.01, maxKw: 10000, ratePerKw: 1800 },
  ],
};

export interface IcCalculationResult {
  isConfigured: boolean;
  ratePerKw: number;
  subtotalRupees: number;
  subtotalPaise: number;
  appliedModel: 'per_kw' | 'slabs';
  matchedSlab?: IcPricingSlab;
  errorMessage?: string;
}

export function calculateIcPrice(
  capacityKw: number,
  config?: Partial<IcPricingConfig> | null
): IcCalculationResult {
  const conf: IcPricingConfig = {
    ...DEFAULT_IC_PRICING,
    ...(config || {}),
  };

  const cap = Number(capacityKw);
  if (isNaN(cap) || cap <= 0) {
    return {
      isConfigured: true,
      ratePerKw: conf.ratePerKw || 0,
      subtotalRupees: 0,
      subtotalPaise: 0,
      appliedModel: conf.pricingModel,
    };
  }

  if (!conf.enabled) {
    return {
      isConfigured: false,
      ratePerKw: 0,
      subtotalRupees: 0,
      subtotalPaise: 0,
      appliedModel: conf.pricingModel,
      errorMessage: 'Solar I&C pricing is currently disabled in Settings. Requires authorized pricing review.',
    };
  }

  if (conf.pricingModel === 'slabs' && Array.isArray(conf.slabs) && conf.slabs.length > 0) {
    const matched = conf.slabs.find(s => cap >= s.minKw && cap <= s.maxKw);
    if (matched && matched.ratePerKw > 0) {
      const subtotalRupees = Math.round(cap * matched.ratePerKw);
      return {
        isConfigured: true,
        ratePerKw: matched.ratePerKw,
        subtotalRupees,
        subtotalPaise: subtotalRupees * 100,
        appliedModel: 'slabs',
        matchedSlab: matched,
      };
    } else {
      return {
        isConfigured: false,
        ratePerKw: 0,
        subtotalRupees: 0,
        subtotalPaise: 0,
        appliedModel: 'slabs',
        errorMessage: `No valid pricing slab configured for ${cap} kW. Requires authorized pricing review.`,
      };
    }
  }

  if (conf.ratePerKw && conf.ratePerKw > 0) {
    const subtotalRupees = Math.round(cap * conf.ratePerKw);
    return {
      isConfigured: true,
      ratePerKw: conf.ratePerKw,
      subtotalRupees,
      subtotalPaise: subtotalRupees * 100,
      appliedModel: 'per_kw',
    };
  }

  return {
    isConfigured: false,
    ratePerKw: 0,
    subtotalRupees: 0,
    subtotalPaise: 0,
    appliedModel: 'per_kw',
    errorMessage: 'Solar I&C rate per kW is not configured (0 or invalid). Requires authorized pricing review.',
  };
}

export interface AllSettingsResponse {
  profile: UserProfile;
  business: BusinessInfo;
  backup: BackupConfig;
  storage: StorageInfo;
  icPricing?: IcPricingConfig;
}
