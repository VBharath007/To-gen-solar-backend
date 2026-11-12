/**
 * Runtime configuration for the backend layer.
 *
 * All filesystem paths are resolved by Electron main (electron/main.ts) using
 * app.getPath('userData') and then injected here via setConfig().
 *
 * The backend never imports Electron directly.  This keeps business
 * logic portable and testable outside an Electron environment.
 */

interface BackendConfig {
  userDataPath:    string;
  dbFilePath:      string;
  attachmentsPath: string;
  exportsPath:     string;
  backupsPath:     string;
  logsPath:        string;
  isDev:           boolean;
}

let _config: BackendConfig | null = null;

export function setConfig(config: BackendConfig): void {
  _config = config;
}

export function isConfigSet(): boolean {
  return _config !== null;
}

export function getConfig(): BackendConfig {
  if (!_config) {
    throw new Error(
      'Backend config has not been set. Call setConfig() in electron/main.ts before using backend services.',
    );
  }
  return _config;
}

export function updateConfig(partial: Partial<BackendConfig>): void {
  if (!_config) {
    throw new Error('Cannot updateConfig before setConfig has been called.');
  }
  _config = { ..._config, ...partial };
}

export function setOrUpdateConfig(config: BackendConfig): void {
  if (_config) {
    _config = { ..._config, ...config };
  } else {
    _config = config;
  }
}

