import { getDb } from '../database/connection';
import { getConfig } from '../config';
import { ok, fail, type ApiResponse } from '@shared/types/api-response.types';
import type {
  UserProfile,
  BusinessInfo,
  BackupConfig,
  AllSettingsResponse,
  IcPricingConfig,
} from '@shared/types/settings.types';
import { DEFAULT_IC_PRICING } from '@shared/types/settings.types';
import { logAudit } from './audit.service';
const getStorageInfo = (): any => ok({provider: 'Firebase Firestore', isWritable: true});
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Administrator',
  email: 'admin@togen.solar',
  phoneNumber: '+91 98765 43210',
};

const DEFAULT_BUSINESS: BusinessInfo = {
  businessName: 'TO-GEN SOLAR AGRO',
  businessEmail: 'contact@togensolar.com',
  primaryPhone: '+91 63803 29294',
  alternatePhone: '',
  address: '3/584-H, Mathur Village, Velliyankundram Group Via, Alagarkoil, Madurai – 625301',
  gstin: '33BJWPA4500M1Z6',
  logoPath: '',
};

const DEFAULT_BACKUP: BackupConfig = {
  autoBackupEnabled: true,
  intervalHours: 24,
  lastStatus: undefined,
};

function getSettingValue<T>(key: string, defaultValue: T): T {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as { value: string } | undefined;
    if (!row?.value) return defaultValue;
    return JSON.parse(row.value) as T;
  } catch {
    return defaultValue;
  }
}

function setSettingValue(key: string, value: any): void {
  const db = getDb();
  const json = JSON.stringify(value);
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, json);
}

export function getUserProfile(): ApiResponse<UserProfile> {
  try {
    const profile = getSettingValue<UserProfile>('user_profile', DEFAULT_PROFILE);
    return ok(profile);
  } catch (err) {
    console.error('[SettingsService.getUserProfile]', err);
    return fail('INTERNAL_ERROR', 'Failed to read user profile');
  }
}

export function updateUserProfile(profile: UserProfile): ApiResponse<UserProfile> {
  try {
    if (!profile.displayName || !profile.displayName.trim()) {
      return fail('VALIDATION_ERROR', 'Display name is required');
    }
    if (!profile.email || !profile.email.includes('@')) {
      return fail('VALIDATION_ERROR', 'Valid email address is required');
    }

    const current = getSettingValue<UserProfile>('user_profile', DEFAULT_PROFILE);
    const updated: UserProfile = {
      displayName: profile.displayName.trim(),
      email: profile.email.trim(),
      phoneNumber: profile.phoneNumber?.trim() || '',
    };

    setSettingValue('user_profile', updated);

    logAudit('PROFILE_UPDATE', 'user_profile', '1', {
      previous: current,
      updated,
    });

    return ok(updated);
  } catch (err) {
    console.error('[SettingsService.updateUserProfile]', err);
    return fail('INTERNAL_ERROR', 'Failed to update user profile');
  }
}

export function getBusinessInfo(): ApiResponse<BusinessInfo> {
  try {
    const business = getSettingValue<BusinessInfo>('business_info', DEFAULT_BUSINESS);
    return ok(business);
  } catch (err) {
    console.error('[SettingsService.getBusinessInfo]', err);
    return fail('INTERNAL_ERROR', 'Failed to read business information');
  }
}

export function updateBusinessInfo(business: BusinessInfo): ApiResponse<BusinessInfo> {
  try {
    if (!business.businessName || !business.businessName.trim()) {
      return fail('VALIDATION_ERROR', 'Business name is required');
    }
    if (!business.businessEmail || !business.businessEmail.includes('@')) {
      return fail('VALIDATION_ERROR', 'Valid business email is required');
    }
    if (!business.primaryPhone || !business.primaryPhone.trim()) {
      return fail('VALIDATION_ERROR', 'Primary phone is required');
    }

    let logoPath = business.logoPath || '';

    // Handle uploaded logo base64 if provided
    if (business.logoBase64 && business.logoBase64.startsWith('data:image/')) {
      try {
        const config = getConfig();
        const businessAssetsDir = join(config.attachmentsPath, 'business');
        if (!existsSync(businessAssetsDir)) {
          mkdirSync(businessAssetsDir, { recursive: true });
        }

        const matches = business.logoBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const base64Data = matches[2];
          const fileName = `logo_${Date.now()}.${ext}`;
          const targetFilePath = join(businessAssetsDir, fileName);
          writeFileSync(targetFilePath, Buffer.from(base64Data, 'base64'));
          // Store relative path for portability
          logoPath = join('attachments', 'business', fileName);
        }
      } catch (logoErr) {
        console.warn('[SettingsService] Failed to save logo file to disk:', logoErr);
      }
    }

    const current = getSettingValue<BusinessInfo>('business_info', DEFAULT_BUSINESS);
    const updated: BusinessInfo = {
      businessName: business.businessName.trim(),
      businessEmail: business.businessEmail.trim(),
      primaryPhone: business.primaryPhone.trim(),
      alternatePhone: business.alternatePhone?.trim() || '',
      address: business.address?.trim() || '',
      gstin: business.gstin?.trim().toUpperCase() || '',
      logoPath,
      logoBase64: business.logoBase64,
    };

    setSettingValue('business_info', updated);

    logAudit('BUSINESS_UPDATE', 'business_info', '1', {
      previous: { ...current, logoBase64: undefined },
      updated: { ...updated, logoBase64: undefined },
    });

    return ok(updated);
  } catch (err) {
    console.error('[SettingsService.updateBusinessInfo]', err);
    return fail('INTERNAL_ERROR', 'Failed to update business information');
  }
}

function computeNextBackupTime(config: BackupConfig): string | undefined {
  if (!config.autoBackupEnabled) return undefined;
  if (config.lastBackupTime) {
    const lastMs = new Date(config.lastBackupTime).getTime();
    if (!isNaN(lastMs)) {
      return new Date(lastMs + (config.intervalHours || 24) * 3600 * 1000).toISOString();
    }
  }
  return config.nextBackupTime || new Date(Date.now() + (config.intervalHours || 24) * 3600 * 1000).toISOString();
}

export function getBackupConfig(): ApiResponse<BackupConfig> {
  try {
    const backup = getSettingValue<BackupConfig>('backup_config', DEFAULT_BACKUP);
    backup.nextBackupTime = computeNextBackupTime(backup);
    return ok(backup);
  } catch (err) {
    console.error('[SettingsService.getBackupConfig]', err);
    return fail('INTERNAL_ERROR', 'Failed to read backup configuration');
  }
}

export function updateBackupConfig(configUpdate: BackupConfig): ApiResponse<BackupConfig> {
  try {
    const current = getSettingValue<BackupConfig>('backup_config', DEFAULT_BACKUP);
    const intervalHours = configUpdate.intervalHours && configUpdate.intervalHours > 0 ? configUpdate.intervalHours : 24;
    const autoBackupEnabled = !!configUpdate.autoBackupEnabled;

    const baseConfig: BackupConfig = {
      ...current,
      autoBackupEnabled,
      intervalHours,
      customBackupPath: configUpdate.customBackupPath?.trim() || undefined,
    };

    const nextBackupTime = computeNextBackupTime(baseConfig);
    const updated: BackupConfig = {
      ...baseConfig,
      nextBackupTime,
    };

    setSettingValue('backup_config', updated);

    logAudit('BACKUP_CONFIG_UPDATE', 'backup_config', '1', {
      previous: current,
      updated,
    });

    return ok(updated);
  } catch (err) {
    console.error('[SettingsService.updateBackupConfig]', err);
    return fail('INTERNAL_ERROR', 'Failed to update backup configuration');
  }
}

export function getIcPricingConfig(): ApiResponse<IcPricingConfig> {
  try {
    const config = getSettingValue<IcPricingConfig>('solar_ic_pricing', DEFAULT_IC_PRICING);
    return ok(config);
  } catch (err) {
    console.error('[SettingsService.getIcPricingConfig]', err);
    return fail('INTERNAL_ERROR', 'Failed to read solar I&C pricing settings');
  }
}

export function updateIcPricingConfig(configUpdate: IcPricingConfig): ApiResponse<IcPricingConfig> {
  try {
    const current = getSettingValue<IcPricingConfig>('solar_ic_pricing', DEFAULT_IC_PRICING);
    const updated: IcPricingConfig = {
      enabled: configUpdate.enabled !== undefined ? !!configUpdate.enabled : true,
      pricingModel: configUpdate.pricingModel === 'slabs' ? 'slabs' : 'per_kw',
      ratePerKw: Number(configUpdate.ratePerKw) >= 0 ? Number(configUpdate.ratePerKw) : 2500,
      slabs: Array.isArray(configUpdate.slabs)
        ? configUpdate.slabs.map(s => ({
            minKw: Number(s.minKw) || 0,
            maxKw: Number(s.maxKw) || 0,
            ratePerKw: Number(s.ratePerKw) || 0,
          }))
        : DEFAULT_IC_PRICING.slabs,
    };

    setSettingValue('solar_ic_pricing', updated);

    logAudit('IC_PRICING_UPDATE', 'solar_ic_pricing', '1', {
      previous: current,
      updated,
    });

    return ok(updated);
  } catch (err) {
    console.error('[SettingsService.updateIcPricingConfig]', err);
    return fail('INTERNAL_ERROR', 'Failed to update solar I&C pricing settings');
  }
}

export function getAllSettings(): ApiResponse<AllSettingsResponse> {
  try {
    const profile = getSettingValue<UserProfile>('user_profile', DEFAULT_PROFILE);
    const business = getSettingValue<BusinessInfo>('business_info', DEFAULT_BUSINESS);
    const backup = getSettingValue<BackupConfig>('backup_config', DEFAULT_BACKUP);
    backup.nextBackupTime = computeNextBackupTime(backup);
    const icPricing = getSettingValue<IcPricingConfig>('solar_ic_pricing', DEFAULT_IC_PRICING);
    const storageRes = getStorageInfo();
    const storage = storageRes.success
      ? storageRes.data
      : {
          dataRoot: '',
          dbPath: '',
          isWritable: false,
          attachmentsCount: 0,
          backupsCount: 0,
          isNetworkPath: false,
        };

    return ok({
      profile,
      business,
      backup,
      storage,
      icPricing,
    });
  } catch (err) {
    console.error('[SettingsService.getAllSettings]', err);
    return fail('INTERNAL_ERROR', 'Failed to retrieve application settings');
  }
}
