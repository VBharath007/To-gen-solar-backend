import React, { useState } from 'react';
import type { DirectoryValidationResult } from '@shared/types/settings.types';

interface FirstRunSetupModalProps {
  onSetupComplete: () => void;
}

export const FirstRunSetupModal: React.FC<FirstRunSetupModalProps> = ({ onSetupComplete }) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [validation, setValidation] = useState<DirectoryValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePickFolder = async () => {
    setErrorMsg(null);
    try {
      setIsValidating(true);
      const res = await window.desktop.storage.selectDirectory();
      if (res.success && res.data) {
        setSelectedFolder(res.data.path);
        setValidation(res.data);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Failed to open directory picker');
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirm = async (mode: 'new' | 'existing') => {
    if (!validation || !validation.isValid) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await window.desktop.storage.completeSetup(validation.path, mode);
      if (res.success) {
        onSetupComplete();
      } else {
        setErrorMsg(res.error?.message || 'Failed to initialize storage location');
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Unexpected error completing setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 25, 47, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0b75b9 0%, #2e8b38 100%)',
            padding: '28px 32px',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px' }}>📂</span>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Choose where to store your CRM data</h2>
          </div>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.9, lineHeight: 1.5 }}>
            To-Gen Solar CRM operates 100% offline. Please choose a local drive folder (e.g. on C:, D:, or E:) to securely store your customers, projects, quotations, and documents.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', color: '#334155', marginBottom: '8px' }}>
              Select Data Storage Location <span style={{ color: '#dc2626' }}>*</span>:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                readOnly
                value={selectedFolder}
                placeholder="Click 'Browse Folder' to select an available local drive..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: '14px',
                  color: '#1e293b',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handlePickFolder}
                disabled={isValidating || isSubmitting}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#0b75b9',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                }}
              >
                {isValidating ? 'Validating...' : 'Browse Folder'}
              </button>
            </div>
          </div>

          {/* Validation Info Box */}
          {validation && (
            <div
              style={{
                backgroundColor: validation.isValid ? '#f0fdf4' : '#fef2f2',
                border: `1.5px solid ${validation.isValid ? '#86efac' : '#fca5a5'}`,
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Final CRM Data Path:</span>
                <strong style={{ color: '#0f172a', wordBreak: 'break-all' }}>{validation.finalPath}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Folder Writability:</span>
                <span style={{ color: validation.isWritable ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                  {validation.isWritable ? '✓ Writable & Accessible' : '✗ Read-only or Permission Denied'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Disk Type:</span>
                <span style={{ color: validation.isNetworkPath ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
                  {validation.isNetworkPath ? '✗ Network Drive (Unsupported)' : '✓ Fixed Local Drive'}
                </span>
              </div>

              {validation.warningMessage && (
                <div style={{ marginTop: '6px', color: '#b45309', fontWeight: 500 }}>
                  ⚠️ {validation.warningMessage}
                </div>
              )}

              {validation.errorMessage && (
                <div style={{ marginTop: '6px', color: '#b91c1c', fontWeight: 600 }}>
                  ⚠️ {validation.errorMessage}
                </div>
              )}

              {validation.hasExistingDataset && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                  }}
                >
                  <strong>Compatible Existing Dataset Detected!</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                    An existing CRM database was found in this folder. You can safely open and adopt it without losing data.
                  </p>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '20px 32px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          {validation?.hasExistingDataset ? (
            <>
              <button
                type="button"
                onClick={() => handleConfirm('existing')}
                disabled={isSubmitting || !validation.isValid}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#2e8b38',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {isSubmitting ? 'Opening...' : 'Open Existing Dataset'}
              </button>
              <button
                type="button"
                onClick={handlePickFolder}
                disabled={isSubmitting}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Choose Different Folder
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleConfirm('new')}
              disabled={isSubmitting || !validation || !validation.isValid}
              style={{
                padding: '12px 28px',
                backgroundColor: validation && validation.isValid ? '#0b75b9' : '#94a3b8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: validation && validation.isValid && !isSubmitting ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
              }}
            >
              {isSubmitting ? 'Configuring Storage...' : 'Confirm & Initialize CRM'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
