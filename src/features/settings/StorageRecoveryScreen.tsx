import React, { useState } from 'react';

interface StorageRecoveryScreenProps {
  missingPath: string;
  onRecovered: () => void;
}

export const StorageRecoveryScreen: React.FC<StorageRecoveryScreenProps> = ({
  missingPath,
  onRecovered,
}) => {
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    setStatusMessage(null);
    try {
      const res = await window.desktop.storage.retryConnection();
      if (res.success) {
        if (res.data.connected) {
          setStatusMessage('Storage drive reconnected successfully! Re-opening CRM...');
          setIsError(false);
          setTimeout(onRecovered, 800);
        } else {
          setStatusMessage(res.data.message || 'Storage drive is still not reachable. Please reconnect the drive or locate the folder.');
          setIsError(true);
        }
      } else {
        setStatusMessage(res.error.message || 'Storage drive check failed.');
        setIsError(true);
      }
    } catch (err) {
      setStatusMessage((err as Error).message);
      setIsError(true);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleLocateExisting = async () => {
    setStatusMessage(null);
    try {
      const pickRes = await window.desktop.storage.selectDirectory();
      if (pickRes.success && pickRes.data) {
        const locateRes = await window.desktop.storage.locateExisting(pickRes.data.path);
        if (locateRes.success) {
          setStatusMessage('Storage location updated successfully!');
          setIsError(false);
          setTimeout(onRecovered, 800);
        } else {
          setStatusMessage(locateRes.error?.message || 'Could not find a valid crm.sqlite in the selected directory.');
          setIsError(true);
        }
      }
    } catch (err) {
      setStatusMessage((err as Error).message);
      setIsError(true);
    }
  };

  const handleRestoreBackup = async () => {
    setStatusMessage(null);
    try {
      const selectRes = await window.desktop.backup.selectArchive();
      if (selectRes.success && selectRes.data?.filePath) {
        const restoreRes = await window.desktop.backup.restore(selectRes.data.filePath);
        if (restoreRes.success) {
          setStatusMessage('CRM dataset successfully restored from backup!');
          setIsError(false);
          setTimeout(onRecovered, 1000);
        } else {
          setStatusMessage(restoreRes.error?.message || 'Failed to restore backup archive.');
          setIsError(true);
        }
      }
    } catch (err) {
      setStatusMessage((err as Error).message);
      setIsError(true);
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
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        zIndex: 999999,
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          width: '100%',
          backgroundColor: '#1e293b',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid #334155',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px 0', color: '#f8fafc' }}>
          Storage Location Unavailable
        </h2>
        <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px 0' }}>
          The CRM cannot reach its configured data directory. Your business records and files are protected and have NOT been deleted.
        </p>

        <div
          style={{
            backgroundColor: '#0f172a',
            border: '1.5px solid #ef4444',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '28px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>
            Missing Data Root:
          </div>
          <div style={{ fontSize: '14px', color: '#f1f5f9', wordBreak: 'break-all', fontFamily: 'monospace' }}>
            {missingPath || 'Unknown location'}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
            If this is an external drive (e.g. USB drive or portable SSD), please make sure it is securely plugged in.
          </div>
        </div>

        {statusMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '24px',
              backgroundColor: isError ? '#450a0a' : '#052e16',
              color: isError ? '#fca5a5' : '#86efac',
              border: `1px solid ${isError ? '#dc2626' : '#16a34a'}`,
              fontSize: '14px',
              textAlign: 'left',
            }}
          >
            {statusMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            style={{
              padding: '14px 24px',
              backgroundColor: '#0b75b9',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {isRetrying ? 'Checking Connection...' : '🔄 Retry Connection'}
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handleLocateExisting}
              style={{
                flex: 1,
                padding: '12px 20px',
                backgroundColor: '#334155',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              📁 Locate Existing Data
            </button>

            <button
              type="button"
              onClick={handleRestoreBackup}
              style={{
                flex: 1,
                padding: '12px 20px',
                backgroundColor: '#1e3a2f',
                color: '#86efac',
                border: '1px solid #16a34a',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              📦 Restore from Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
