import React, { useState, useEffect } from 'react';
import { useUserProfile } from '../../context/UserProfileContext';
import type {
  UserProfile,
  BusinessInfo,
  BackupConfig,
  StorageInfo,
  BackupItem,
  DirectoryValidationResult,
} from '@shared/types/settings.types';
import { validateName, validatePhone, validateEmail, sanitizeNameInput, sanitizePhoneInput } from '../../utils/validation';
import { AlertDialogModal } from '@/components/ui/AlertDialogModal';

type SettingsTab = 'profile' | 'business' | 'storage' | 'autobackup' | 'restore';

export const SettingsView: React.FC = () => {
  const { profile: globalProfile, updateProfile: updateGlobalProfile } = useUserProfile();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validation error states
  const [profileErrors, setProfileErrors] = useState<{ displayName?: string; email?: string; phoneNumber?: string }>({});
  const [businessErrors, setBusinessErrors] = useState<{ businessName?: string; businessEmail?: string; primaryPhone?: string; alternatePhone?: string }>({});

  // Form states
  const [profileForm, setProfileForm] = useState<UserProfile>({
    displayName: '',
    email: '',
    phoneNumber: '',
  });

  const [businessForm, setBusinessForm] = useState<BusinessInfo>({
    businessName: '',
    businessEmail: '',
    primaryPhone: '',
    alternatePhone: '',
    address: '',
    gstin: '',
    logoPath: '',
    logoBase64: '',
  });

  const [backupConfigForm, setBackupConfigForm] = useState<BackupConfig>({
    autoBackupEnabled: true,
    intervalHours: 24,
    customBackupPath: '',
  });

  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [backupList, setBackupList] = useState<BackupItem[]>([]);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Migration Modal state
  const [showMigrateModal, setShowMigrateModal] = useState<boolean>(false);
  const [migrateTarget, setMigrateTarget] = useState<string>('');
  const [migrateValidation, setMigrateValidation] = useState<DirectoryValidationResult | null>(null);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [migrateStatus, setMigrateStatus] = useState<string | null>(null);

  // Restore Modal state
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [restoreFilePath, setRestoreFilePath] = useState<string>('');
  const [restoreManifest, setRestoreManifest] = useState<any | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Alert Modal popup state
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    description: '',
  });

  // Load all settings
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      if (window.desktop?.settings?.getAll) {
        const res = await window.desktop.settings.getAll();
        if (res.success && res.data) {
          setProfileForm(res.data.profile);
          setBusinessForm(res.data.business);
          setBackupConfigForm(res.data.backup);
          setStorageInfo(res.data.storage);
        }
      }

      if (window.desktop?.backup?.list) {
        const bRes = await window.desktop.backup.list();
        if (bRes.success && bRes.data) {
          setBackupList(bRes.data);
        }
      }
    } catch (err) {
      console.error('[SettingsView] Error loading settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Update profileForm if globalProfile changes externally
  useEffect(() => {
    if (globalProfile.displayName) {
      setProfileForm((prev) => ({
        ...prev,
        displayName: globalProfile.displayName,
        email: globalProfile.email,
        phoneNumber: globalProfile.phoneNumber,
      }));
    }
  }, [globalProfile]);

  // ── Save Handlers ──────────────────────────────────────────────────────────
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: { displayName?: string; email?: string; phoneNumber?: string } = {};
    const nameRes = validateName(profileForm.displayName, 'Display Name', true);
    if (!nameRes.isValid) errs.displayName = nameRes.error!;

    const emailRes = validateEmail(profileForm.email, true);
    if (!emailRes.isValid) errs.email = emailRes.error!;

    if (profileForm.phoneNumber) {
      const phoneRes = validatePhone(profileForm.phoneNumber, false, 'Phone number');
      if (!phoneRes.isValid) errs.phoneNumber = phoneRes.error!;
    }

    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Profile Validation',
        description: 'Please correct the errors before saving profile.',
        confirmLabel: 'OK',
      });
      return;
    }

    setIsSaving(true);
    try {
      const ok = await updateGlobalProfile(profileForm);
      if (ok) {
        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Profile Updated',
          description: 'User profile updated successfully! Header refreshed.',
          confirmLabel: 'OK',
        });
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Profile Update Failed',
          description: 'Failed to save profile changes.',
          confirmLabel: 'Close',
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Profile Update Error',
        description: (err as Error).message,
        confirmLabel: 'Close',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: { businessName?: string; businessEmail?: string; primaryPhone?: string; alternatePhone?: string } = {};
    const bNameRes = validateName(businessForm.businessName, 'Business Name', true);
    if (!bNameRes.isValid) errs.businessName = bNameRes.error!;

    const bEmailRes = validateEmail(businessForm.businessEmail, true);
    if (!bEmailRes.isValid) errs.businessEmail = bEmailRes.error!;

    const pPhoneRes = validatePhone(businessForm.primaryPhone, true, 'Primary phone');
    if (!pPhoneRes.isValid) errs.primaryPhone = pPhoneRes.error!;

    if (businessForm.alternatePhone) {
      const aPhoneRes = validatePhone(businessForm.alternatePhone, false, 'Alternate phone');
      if (!aPhoneRes.isValid) errs.alternatePhone = aPhoneRes.error!;
    }

    setBusinessErrors(errs);
    if (Object.keys(errs).length > 0) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Business Info Error',
        description: 'Please correct the errors before saving business details.',
        confirmLabel: 'OK',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await window.desktop.settings.updateBusiness(businessForm);
      if (res.success) {
        setBusinessForm(res.data);
        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Business Information Saved',
          description: 'Business information saved. Newly issued quotations & invoices will use these details.',
          confirmLabel: 'OK',
        });
      } else {
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Business Update Failed',
          description: res.error?.message || 'Failed to update business information.',
          confirmLabel: 'Close',
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Business Update Error',
        description: (err as Error).message,
        confirmLabel: 'Close',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Helper to calculate next backup time dynamically ──────────────────────
  const calculateNextBackupTime = (lastBackupTime?: string, intervalHours = 24, autoBackupEnabled = true): string | undefined => {
    if (!autoBackupEnabled) return undefined;
    if (lastBackupTime) {
      const lastMs = new Date(lastBackupTime).getTime();
      if (!isNaN(lastMs)) {
        return new Date(lastMs + intervalHours * 3600 * 1000).toISOString();
      }
    }
    return new Date(Date.now() + intervalHours * 3600 * 1000).toISOString();
  };

  const handleToggleAutoBackup = (enabled: boolean) => {
    const nextTime = calculateNextBackupTime(backupConfigForm.lastBackupTime, backupConfigForm.intervalHours, enabled);
    setBackupConfigForm((prev) => ({
      ...prev,
      autoBackupEnabled: enabled,
      nextBackupTime: nextTime,
    }));
  };

  const handleIntervalChange = (hours: number) => {
    const nextTime = calculateNextBackupTime(backupConfigForm.lastBackupTime, hours, backupConfigForm.autoBackupEnabled);
    setBackupConfigForm((prev) => ({
      ...prev,
      intervalHours: hours,
      nextBackupTime: nextTime,
    }));
  };

  const handleSaveBackupConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (backupConfigForm.autoBackupEnabled && (!backupConfigForm.customBackupPath || !backupConfigForm.customBackupPath.trim())) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Backup Directory Required',
        description: 'Please select a backup directory before saving the automatic backup schedule.',
        confirmLabel: 'Understood',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await window.desktop.settings.updateBackupConfig(backupConfigForm);
      if (res.success) {
        setBackupConfigForm(res.data);
        const intervalText = res.data.autoBackupEnabled
          ? `Every ${res.data.intervalHours} hours`
          : 'Disabled';
        const nextTimeText = res.data.nextBackupTime
          ? new Date(res.data.nextBackupTime).toLocaleString()
          : 'None';

        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Backup Schedule Saved',
          description: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', marginTop: '6px' }}>
              <p style={{ margin: 0, textAlign: 'center', fontWeight: 500 }}>
                Automatic backup schedule has been updated successfully.
              </p>
              <div style={{ backgroundColor: 'var(--bg-surface-subtle, #f1f5f9)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                <div><strong>Schedule Status:</strong> {res.data.autoBackupEnabled ? '✅ Enabled' : '⏸️ Disabled'}</div>
                <div><strong>Backup Interval:</strong> {intervalText}</div>
                <div><strong>Next Scheduled Backup:</strong> {nextTimeText}</div>
                {res.data.customBackupPath && (
                  <div style={{ wordBreak: 'break-all', marginTop: '4px' }}>
                    <strong>Destination:</strong> {res.data.customBackupPath}
                  </div>
                )}
              </div>
            </div>
          ),
          confirmLabel: 'OK',
        });
      } else {
        const errorMsg = res.error?.message || 'Failed to update backup settings.';
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Schedule Update Failed',
          description: errorMsg,
          confirmLabel: 'Close',
        });
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Schedule Update Error',
        description: errorMsg,
        confirmLabel: 'Close',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Backup Actions ─────────────────────────────────────────────────────────
  const handleBackupNow = async () => {
    let targetPath = backupConfigForm.customBackupPath?.trim();
    if (!targetPath) {
      const pickRes = await window.desktop.storage.selectDirectory();
      if (!pickRes.success || !pickRes.data?.path) {
        return;
      }
      targetPath = pickRes.data.path;
      setBackupConfigForm((prev) => ({ ...prev, customBackupPath: targetPath }));
      try {
        await window.desktop.settings.updateBackupConfig({ ...backupConfigForm, customBackupPath: targetPath });
      } catch (e) {}
    }

    setIsBackingUp(true);
    try {
      const res = await window.desktop.backup.create(targetPath);
      if (res.success) {
        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Backup Completed Successfully!',
          description: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', marginTop: '6px' }}>
              <p style={{ margin: 0, textAlign: 'center', fontWeight: 500 }}>
                All modules, documents, site photos, settings &amp; database have been stored in <strong>Backuped data of ToGen</strong>!
              </p>
              <div style={{ backgroundColor: 'var(--bg-surface-subtle, #f1f5f9)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ marginBottom: '4px' }}><strong>Archive:</strong> {res.data.filename} ({res.data.sizeFormatted})</div>
                <div style={{ wordBreak: 'break-all' }}><strong>Location:</strong> {targetPath}\Backuped data of ToGen\</div>
                <div style={{ marginTop: '6px', color: '#166534', fontWeight: 600 }}>
                  📁 Leads &bull; Customers &bull; Quotations &bull; Products &bull; Packages &bull; Site Surveys &bull; Projects &bull; Invoices &bull; Payments &bull; Reports &bull; Settings &bull; Database
                </div>
              </div>
            </div>
          ),
          confirmLabel: 'Done',
        });
        loadSettings();
      } else {
        const errorMsg = res.error?.message || 'Backup failed.';
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Backup Failed',
          description: errorMsg,
          confirmLabel: 'Close',
        });
      }
    } catch (err) {
      const errorMsg = (err as Error).message;
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Backup Error',
        description: errorMsg,
        confirmLabel: 'Close',
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // ── Migration Handlers ─────────────────────────────────────────────────────
  const handlePickMigrationDestination = async () => {
    try {
      const res = await window.desktop.storage.selectDirectory();
      if (res.success && res.data) {
        setMigrateTarget(res.data.path);
        setMigrateValidation(res.data);
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Folder Selection Error',
        description: (err as Error).message,
        confirmLabel: 'Close',
      });
    }
  };

  const handleExecuteMigration = async () => {
    if (!migrateValidation || !migrateValidation.isValid) return;
    setIsMigrating(true);
    setMigrateStatus('Performing WAL checkpoint and copying records...');
    try {
      const res = await window.desktop.storage.migrate(migrateValidation.path);
      if (res.success) {
        setMigrateStatus('Migration succeeded! Re-opening CRM database...');
        setTimeout(() => {
          setShowMigrateModal(false);
          setIsMigrating(false);
          setMigrateStatus(null);
          loadSettings();
          setAlertModal({
            isOpen: true,
            type: 'success',
            title: 'Storage Migration Complete',
            description: `Storage safely migrated to: ${res.data.newDataRoot}. Original folder preserved as recovery backup.`,
            confirmLabel: 'OK',
          });
        }, 1200);
      } else {
        setIsMigrating(false);
        setMigrateStatus(`Migration failed: ${res.error?.message}`);
      }
    } catch (err) {
      setIsMigrating(false);
      setMigrateStatus(`Error: ${(err as Error).message}`);
    }
  };

  // ── Restore Handlers ───────────────────────────────────────────────────────
  const handleSelectRestoreArchive = async () => {
    try {
      const res = await window.desktop.backup.selectArchive();
      if (res.success && res.data?.filePath) {
        setRestoreFilePath(res.data.filePath);
        setRestoreManifest(res.data.manifest || null);
        setShowRestoreModal(true);
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Archive Selection Error',
        description: (err as Error).message,
        confirmLabel: 'Close',
      });
    }
  };

  const handleSelectRestoreFolder = async () => {
    try {
      const res = await window.desktop.storage.selectDirectory();
      if (res.success && res.data?.path) {
        const folderPath = res.data.path;
        const val = await window.desktop.backup.validate(folderPath);
        if (val.success && val.data?.isValid) {
          setRestoreFilePath(folderPath);
          setRestoreManifest(val.data.manifest || null);
          setShowRestoreModal(true);
        } else {
          const errDetail = val.success ? val.data?.error : val.error?.message;
          setAlertModal({
            isOpen: true,
            type: 'error',
            title: 'Invalid Backup Folder',
            description: errDetail || 'The selected folder does not contain a Database/crm.sqlite file.',
            confirmLabel: 'Close',
          });
        }
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Folder Selection Error',
        description: (err as Error).message,
        confirmLabel: 'Close',
      });
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreFilePath) return;
    setIsRestoring(true);
    try {
      const res = await window.desktop.backup.restore(restoreFilePath);
      if (res.success) {
        setShowRestoreModal(false);
        setIsRestoring(false);
        loadSettings();
        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Dataset Restored Successfully',
          description: 'Dataset restored successfully! Pre-restore recovery backup created.',
          confirmLabel: 'OK',
        });
      } else {
        setIsRestoring(false);
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Restore Failed',
          description: res.error?.message || 'Restore failed.',
          confirmLabel: 'Close',
        });
      }
    } catch (err) {
      setIsRestoring(false);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Restore Error',
        description: (err as Error).message,
        confirmLabel: 'Close',
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
        <p style={{ fontWeight: 600 }}>Loading Settings & Storage Info...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
          Settings & Preferences
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Manage your personal profile, company information, storage location, and automatic backup safeguards.
        </p>
      </div>

      {/* Modern Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '28px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #0b75b9' : '3px solid transparent',
            color: activeTab === 'profile' ? '#0b75b9' : '#64748b',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
          }}
        >
          <span>👤</span> User Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('business')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'business' ? '3px solid #0b75b9' : '3px solid transparent',
            color: activeTab === 'business' ? '#0b75b9' : '#64748b',
            fontWeight: activeTab === 'business' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
          }}
        >
          <span>🏢</span> Business Information
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('storage')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'storage' ? '3px solid #0b75b9' : '3px solid transparent',
            color: activeTab === 'storage' ? '#0b75b9' : '#64748b',
            fontWeight: activeTab === 'storage' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
          }}
        >
          <span>📁</span> Storage Location
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('autobackup')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'autobackup' ? '3px solid #0b75b9' : '3px solid transparent',
            color: activeTab === 'autobackup' ? '#0b75b9' : '#64748b',
            fontWeight: activeTab === 'autobackup' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
          }}
        >
          <span>⏱️</span> Automatic Backup
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('restore')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'restore' ? '3px solid #0b75b9' : '3px solid transparent',
            color: activeTab === 'restore' ? '#0b75b9' : '#64748b',
            fontWeight: activeTab === 'restore' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
          }}
        >
          <span>📦</span> Backup & Restore
        </button>
      </div>

      {/* ── TAB 1: User Profile ── */}
      {activeTab === 'profile' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>Personal Profile</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Updating your display name automatically refreshes the topbar header initials and name in real-time.
            </p>
          </div>

          <form noValidate onSubmit={handleSaveProfile} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Display Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={(e) => {
                  const val = sanitizeNameInput(e.target.value);
                  setProfileForm({ ...profileForm, displayName: val });
                  if (profileErrors.displayName) {
                    const res = validateName(val, 'Display Name', true);
                    setProfileErrors(p => ({ ...p, displayName: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  const res = validateName(profileForm.displayName, 'Display Name', true);
                  setProfileErrors(p => ({ ...p, displayName: res.isValid ? undefined : res.error! }));
                }}
                required
                placeholder="e.g. Karthik Kumar"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: profileErrors.displayName ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: profileErrors.displayName ? '#fff8f8' : undefined,
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {profileErrors.displayName && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {profileErrors.displayName}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Contact Email <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => {
                  setProfileForm({ ...profileForm, email: e.target.value });
                  if (profileErrors.email) {
                    const res = validateEmail(e.target.value, true);
                    setProfileErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  const res = validateEmail(profileForm.email, true);
                  setProfileErrors(p => ({ ...p, email: res.isValid ? undefined : res.error! }));
                }}
                required
                placeholder="admin@togen.solar"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: profileErrors.email ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: profileErrors.email ? '#fff8f8' : undefined,
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {profileErrors.email ? (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {profileErrors.email}
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  Editing contact email does not modify your local database credentials.
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Phone Number
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={profileForm.phoneNumber}
                onChange={(e) => {
                  const val = sanitizePhoneInput(e.target.value);
                  setProfileForm({ ...profileForm, phoneNumber: val });
                  if (profileErrors.phoneNumber) {
                    const res = validatePhone(val, false, 'Phone number');
                    setProfileErrors(p => ({ ...p, phoneNumber: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  if (profileForm.phoneNumber) {
                    const res = validatePhone(profileForm.phoneNumber, false, 'Phone number');
                    setProfileErrors(p => ({ ...p, phoneNumber: res.isValid ? undefined : res.error! }));
                  }
                }}
                placeholder="10-digit phone number"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: profileErrors.phoneNumber ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: profileErrors.phoneNumber ? '#fff8f8' : undefined,
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {profileErrors.phoneNumber && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {profileErrors.phoneNumber}
                </span>
              )}
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: '12px 28px',
                  backgroundColor: '#0b75b9',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                {isSaving ? 'Saving Changes...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: Business Information ── */}
      {activeTab === 'business' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>Company & Billing Profile</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              These details are attached as snapshots to newly generated Quotations, Invoices, and Payment Receipts.
            </p>
          </div>

          <form onSubmit={handleSaveBusiness} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Business Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={businessForm.businessName}
                onChange={(e) => {
                  const val = sanitizeNameInput(e.target.value);
                  setBusinessForm({ ...businessForm, businessName: val });
                  if (businessErrors.businessName) {
                    const res = validateName(val, 'Business Name', true);
                    setBusinessErrors(p => ({ ...p, businessName: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  const res = validateName(businessForm.businessName, 'Business Name', true);
                  setBusinessErrors(p => ({ ...p, businessName: res.isValid ? undefined : res.error! }));
                }}
                required
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: businessErrors.businessName ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: businessErrors.businessName ? '#fff8f8' : undefined,
                  fontSize: '14px', 
                  outline: 'none' 
                }}
              />
              {businessErrors.businessName && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {businessErrors.businessName}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Business Email <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="email"
                value={businessForm.businessEmail}
                onChange={(e) => {
                  setBusinessForm({ ...businessForm, businessEmail: e.target.value });
                  if (businessErrors.businessEmail) {
                    const res = validateEmail(e.target.value, true);
                    setBusinessErrors(p => ({ ...p, businessEmail: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  const res = validateEmail(businessForm.businessEmail, true);
                  setBusinessErrors(p => ({ ...p, businessEmail: res.isValid ? undefined : res.error! }));
                }}
                required
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: businessErrors.businessEmail ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: businessErrors.businessEmail ? '#fff8f8' : undefined,
                  fontSize: '14px', 
                  outline: 'none' 
                }}
              />
              {businessErrors.businessEmail && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {businessErrors.businessEmail}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Primary Phone <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={businessForm.primaryPhone}
                onChange={(e) => {
                  const val = sanitizePhoneInput(e.target.value);
                  setBusinessForm({ ...businessForm, primaryPhone: val });
                  if (businessErrors.primaryPhone) {
                    const res = validatePhone(val, true, 'Primary phone');
                    setBusinessErrors(p => ({ ...p, primaryPhone: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  const res = validatePhone(businessForm.primaryPhone, true, 'Primary phone');
                  setBusinessErrors(p => ({ ...p, primaryPhone: res.isValid ? undefined : res.error! }));
                }}
                required
                placeholder="10-digit mobile number"
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: businessErrors.primaryPhone ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: businessErrors.primaryPhone ? '#fff8f8' : undefined,
                  fontSize: '14px', 
                  outline: 'none' 
                }}
              />
              {businessErrors.primaryPhone && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {businessErrors.primaryPhone}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Alternate Phone
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={businessForm.alternatePhone}
                onChange={(e) => {
                  const val = sanitizePhoneInput(e.target.value);
                  setBusinessForm({ ...businessForm, alternatePhone: val });
                  if (businessErrors.alternatePhone) {
                    const res = validatePhone(val, false, 'Alternate phone');
                    setBusinessErrors(p => ({ ...p, alternatePhone: res.isValid ? undefined : res.error! }));
                  }
                }}
                onBlur={() => {
                  if (businessForm.alternatePhone) {
                    const res = validatePhone(businessForm.alternatePhone, false, 'Alternate phone');
                    setBusinessErrors(p => ({ ...p, alternatePhone: res.isValid ? undefined : res.error! }));
                  }
                }}
                placeholder="Optional 10-digit number"
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  borderRadius: '8px', 
                  border: businessErrors.alternatePhone ? '1.5px solid var(--danger-color)' : '1.5px solid #cbd5e1',
                  backgroundColor: businessErrors.alternatePhone ? '#fff8f8' : undefined,
                  fontSize: '14px', 
                  outline: 'none' 
                }}
              />
              {businessErrors.alternatePhone && (
                <span style={{ color: 'var(--danger-color)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  {businessErrors.alternatePhone}
                </span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                GSTIN (Goods & Services Tax ID)
              </label>
              <input
                type="text"
                value={businessForm.gstin}
                onChange={(e) => setBusinessForm({ ...businessForm, gstin: e.target.value })}
                placeholder="e.g. 33AABCT1234A1Z5"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none', textTransform: 'uppercase' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Registered Business Address
              </label>
              <textarea
                rows={3}
                value={businessForm.address}
                onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: '12px 28px',
                  backgroundColor: '#2e8b38',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                {isSaving ? 'Saving Business Info...' : 'Save Business Information'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 3: Storage Location ── */}
      {activeTab === 'storage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>Current Storage Layout</h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Active offline location storing your continuous SQLite database, attachments, documents, and backups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMigrateTarget('');
                  setMigrateValidation(null);
                  setShowMigrateModal(true);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0b75b9',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                🔄 Change Storage Location
              </button>
            </div>

            {/* Storage Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>SQLite Database Status</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>●</span> Online & Active
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  File Size: {storageInfo?.dbSizeFormatted || 'N/A'}
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Writability & Permissions</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: storageInfo?.isWritable ? '#15803d' : '#b91c1c' }}>
                  {storageInfo?.isWritable ? '✓ Verified Read/Write' : '✗ Read-Only'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Disk Type: {storageInfo?.isNetworkPath ? 'Network Drive' : 'Local Fixed Disk'}
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Managed Attachments</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {storageInfo?.attachmentsCount || 0} files
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Organized by YYYY/MM
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>Local Backup Archives</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {storageInfo?.backupsCount || 0} packages
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  In backups/ directory
                </div>
              </div>
            </div>

            {/* Active Data Root details */}
            <div style={{ backgroundColor: '#f1f5f9', padding: '16px 20px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
                Active Data Root Directory:
              </div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#0f172a', wordBreak: 'break-all', fontWeight: 600 }}>
                {storageInfo?.dataRoot || 'Loading...'}
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                ℹ️ Note: Electron may also maintain small cache/log files in its standard system directory, while all business records, quotes, and attachments remain strictly in this selected root.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Automatic Backup ── */}
      {activeTab === 'autobackup' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>Automated Backup Safeguards</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Automatic backups run quietly in the background while the application is open. Missed backups run at next launch.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBackupNow}
              disabled={isBackingUp}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2e8b38',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: isBackingUp ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isBackingUp ? 'Creating Backup...' : '⚡ Backup Now'}
            </button>
          </div>

          {/* Backup status cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Last Successful Backup</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {backupConfigForm.lastBackupTime ? new Date(backupConfigForm.lastBackupTime).toLocaleString() : 'Never'}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Next Scheduled Backup</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0b75b9' }}>
                {(() => {
                  if (!backupConfigForm.autoBackupEnabled) return 'Disabled';
                  const nextTimeStr = backupConfigForm.nextBackupTime || calculateNextBackupTime(backupConfigForm.lastBackupTime, backupConfigForm.intervalHours, true);
                  if (!nextTimeStr) return 'Scheduled upon next launch';
                  const nextDate = new Date(nextTimeStr);
                  const isPast = nextDate.getTime() <= Date.now();
                  return (
                    <span>
                      {nextDate.toLocaleString()}
                      {isPast && (
                        <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, marginLeft: '6px' }}>
                          (Due)
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Last Backup Status</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: backupConfigForm.lastStatus === 'failed' ? '#b91c1c' : '#15803d' }}>
                {backupConfigForm.lastStatus === 'failed' ? `⚠️ Failed: ${backupConfigForm.lastError || ''}` : backupConfigForm.lastStatus === 'success' ? '✓ Successful' : 'Pending'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveBackupConfig} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Auto backup toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="autoBackupEnabled"
                checked={backupConfigForm.autoBackupEnabled}
                onChange={(e) => handleToggleAutoBackup(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="autoBackupEnabled" style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}>
                Enable Automatic Background Backups
              </label>
            </div>

            {/* Interval selector */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Backup Interval
              </label>
              <select
                value={backupConfigForm.intervalHours}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                disabled={!backupConfigForm.autoBackupEnabled}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  backgroundColor: backupConfigForm.autoBackupEnabled ? '#ffffff' : '#f1f5f9',
                  maxWidth: '300px',
                  width: '100%',
                }}
              >
                <option value={6}>Every 6 Hours</option>
                <option value={12}>Every 12 Hours</option>
                <option value={24}>Every 24 Hours (Daily - Recommended)</option>
                <option value={48}>Every 48 Hours</option>
              </select>
            </div>

            {/* Custom destination */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Backup Storage Directory <span style={{ color: '#dc2626' }}>*</span> (Required)
              </label>
              <div style={{ display: 'flex', gap: '12px', maxWidth: '640px' }}>
                <input
                  type="text"
                  readOnly
                  value={backupConfigForm.customBackupPath || ''}
                  placeholder="Select a folder to store backup files (Click 'Choose Folder')"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: !backupConfigForm.customBackupPath ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    backgroundColor: '#f8fafc',
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const res = await window.desktop.storage.selectDirectory();
                    if (res.success && res.data) {
                      setBackupConfigForm({ ...backupConfigForm, customBackupPath: res.data.path });
                    }
                  }}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Choose Folder
                </button>
                {backupConfigForm.customBackupPath && (
                  <button
                    type="button"
                    onClick={() => setBackupConfigForm({ ...backupConfigForm, customBackupPath: '' })}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fca5a5',
                      color: '#b91c1c',
                      borderRadius: '8px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {!backupConfigForm.customBackupPath && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '5px', fontWeight: 500 }}>
                  ⚠️ Backup directory is required. Please select a folder before creating a backup.
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#b45309', marginTop: '6px' }}>
                ⚠️ Notice: Backing up onto the same physical drive protects against accidental data corruption, but not against hardware drive failure. An external drive is strongly recommended for offsite safety.
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: '12px 28px',
                  backgroundColor: '#0b75b9',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {isSaving ? 'Saving...' : 'Save Backup Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 5: Backup & Restore ── */}
      {activeTab === 'restore' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Action Card */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>Transfer & Restore Data</h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Transfer CRM records, attachments, and settings between computers using standard ToGen backup packages (.tgbak).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={isBackingUp}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#0b75b9',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: isBackingUp ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isBackingUp ? 'Creating...' : '+ Create New Backup'}
                </button>
                <button
                  type="button"
                  onClick={handleSelectRestoreArchive}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#2e8b38',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  📥 Restore from File (.tgbak)
                </button>
                <button
                  type="button"
                  onClick={handleSelectRestoreFolder}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  📁 Restore from Backup Folder
                </button>
              </div>
            </div>

            {/* Backup Directory Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>📁 Backup Target Folder:</span>
                <span style={{ color: backupConfigForm.customBackupPath ? '#0f172a' : '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {backupConfigForm.customBackupPath ? `${backupConfigForm.customBackupPath}\\Backuped data of ToGen\\` : 'Not configured yet (will prompt to select on Backup Now)'}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await window.desktop.storage.selectDirectory();
                  if (res.success && res.data?.path) {
                    const chosen = res.data.path;
                    setBackupConfigForm(prev => ({ ...prev, customBackupPath: chosen }));
                    await window.desktop.settings.updateBackupConfig({ ...backupConfigForm, customBackupPath: chosen });
                  }
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                {backupConfigForm.customBackupPath ? 'Change Destination Folder' : 'Select Destination Folder'}
              </button>
            </div>

            <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
              💡 <strong>Transferring to Another Computer:</strong>
              <br />
              1. Click "Create New Backup" on this PC and copy the generated <code>.tgbak</code> file to a USB drive.
              <br />
              2. On your new Windows computer, launch ToGen Solar CRM, select your preferred local folder, and click "Restore from Backup File".
              <br />
              3. The CRM will automatically configure machine-specific storage paths without requiring the old drive letter.
            </div>
          </div>

          {/* Backup History Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>Available Backup Archives</h3>

            {backupList.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                No backup archives found. Click "Create New Backup" above to generate your first verified snapshot.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Archive Filename</th>
                      <th style={{ padding: '10px 14px', whiteSpace: 'nowrap', minWidth: '150px' }}>Created Date</th>
                      <th style={{ padding: '10px 14px', whiteSpace: 'nowrap', minWidth: '90px' }}>File Size</th>
                      <th style={{ padding: '10px 14px', minWidth: '200px' }}>Location</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '100px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupList.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          📦 {item.filename}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                          {item.sizeFormatted}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.filepath}>
                          {item.filepath}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setRestoreFilePath(item.filepath);
                              setRestoreManifest(item.manifest || null);
                              setShowRestoreModal(true);
                            }}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: '#334155',
                            }}
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MIGRATION MODAL ── */}
      {showMigrateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '640px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', backgroundColor: '#0b75b9', color: '#ffffff' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Migrate CRM Storage Location</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                Controlled 9-step migration: WAL checkpoint, integrity check, atomic switchover, and safety rollback copy.
              </p>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Select Target Destination Folder:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={migrateTarget}
                    placeholder="Click 'Browse Folder'..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px', backgroundColor: '#f8fafc' }}
                  />
                  <button
                    type="button"
                    onClick={handlePickMigrationDestination}
                    disabled={isMigrating}
                    style={{ padding: '10px 16px', backgroundColor: '#0b75b9', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                  >
                    Browse Folder
                  </button>
                </div>
              </div>

              {migrateValidation && (
                <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: migrateValidation.isValid ? '#f0fdf4' : '#fef2f2', border: `1px solid ${migrateValidation.isValid ? '#86efac' : '#fca5a5'}`, fontSize: '13px' }}>
                  <div>Final Data Path: <strong>{migrateValidation.finalPath}</strong></div>
                  <div>Writability: <strong>{migrateValidation.isWritable ? 'Writable' : 'Permission Denied'}</strong></div>
                  {migrateValidation.errorMessage && <div style={{ color: '#b91c1c', marginTop: '6px' }}>⚠️ {migrateValidation.errorMessage}</div>}
                  {migrateValidation.warningMessage && <div style={{ color: '#b45309', marginTop: '6px' }}>⚠️ {migrateValidation.warningMessage}</div>}
                </div>
              )}

              {migrateStatus && (
                <div style={{ padding: '12px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                  ℹ️ {migrateStatus}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowMigrateModal(false)}
                disabled={isMigrating}
                style={{ padding: '10px 16px', backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteMigration}
                disabled={isMigrating || !migrateValidation || !migrateValidation.isValid}
                style={{
                  padding: '10px 22px',
                  backgroundColor: migrateValidation?.isValid ? '#0b75b9' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: migrateValidation?.isValid && !isMigrating ? 'pointer' : 'not-allowed',
                }}
              >
                {isMigrating ? 'Migrating Dataset...' : 'Start Safe Migration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTORE CONFIRMATION MODAL ── */}
      {showRestoreModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '600px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', backgroundColor: '#dc2626', color: '#ffffff' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>⚠️ Confirm Dataset Restore</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                Restoring will replace current active records with the backup. A safety backup will be created first.
              </p>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ color: '#64748b', marginBottom: '4px' }}>Selected Archive:</div>
                <div style={{ fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>{restoreFilePath}</div>
                {restoreManifest && (
                  <div style={{ marginTop: '8px', color: '#475569' }}>
                    Backup Date: <strong>{new Date(restoreManifest.createdAt).toLocaleString()}</strong>
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca', color: '#991b1b' }}>
                🛡️ <strong>Safety Guarantee:</strong> An automatic pre-restore safety backup is created before modifying your live data. If any error occurs during restoration, your active database will be completely preserved.
              </div>
            </div>

            <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowRestoreModal(false)}
                disabled={isRestoring}
                style={{ padding: '10px 16px', backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                style={{
                  padding: '10px 22px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: isRestoring ? 'not-allowed' : 'pointer',
                }}
              >
                {isRestoring ? 'Restoring Dataset...' : 'Confirm & Restore Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Alert Popup Modal ── */}
      <AlertDialogModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        description={alertModal.description}
        confirmLabel={alertModal.confirmLabel || 'OK'}
        onConfirm={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default SettingsView;
