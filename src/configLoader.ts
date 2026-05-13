import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ConfigEntry {
  name: string;
  /** 'launch' uses a named entry from launch.json; 'script' runs a terminal command */
  type: 'launch' | 'script';
  // launch
  launchConfig?: string;
  // script
  cwd?: string;
  command?: string;
  envFile?: string;               // path to a .env file
  env?: Record<string, string>;  // individual vars (merged on top of envFile)
}

export interface MultirunGroup {
  name: string;
  sequential: boolean;
  delay?: number;
  configurations: ConfigEntry[];
}

export interface MultirunConfig {
  version: string;
  groups: MultirunGroup[];
}

export function getConfigPath(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  return path.join(folders[0].uri.fsPath, '.vscode', 'multirun.json');
}

export function loadConfig(): MultirunConfig {
  const configPath = getConfigPath();
  if (!configPath || !fs.existsSync(configPath)) {
    return { version: '1.0.0', groups: [] };
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as MultirunConfig;
    // Migrate old format where configurations was string[]
    for (const group of config.groups) {
      group.configurations = ((group.configurations ?? []) as unknown[]).map(c => {
        if (typeof c === 'string') {
          return { name: c, type: 'launch' as const, launchConfig: c };
        }
        return c as ConfigEntry;
      });
    }
    return config;
  } catch {
    vscode.window.showErrorMessage('Multirun: Failed to parse multirun.json');
    return { version: '1.0.0', groups: [] };
  }
}

export async function ensureConfigExists(): Promise<vscode.Uri | undefined> {
  const configPath = getConfigPath();
  if (!configPath) {
    vscode.window.showErrorMessage('Multirun: No workspace folder found.');
    return undefined;
  }
  if (!fs.existsSync(configPath)) {
    const defaultConfig: MultirunConfig = {
      version: '1.0.0',
      groups: [
        {
          name: 'Example Group',
          sequential: false,
          delay: 500,
          configurations: [
            { name: 'Launch Program', type: 'launch', launchConfig: 'Launch Program' },
            { name: 'Dev Server', type: 'script', cwd: '', command: 'npm run dev', env: { NODE_ENV: 'development' } }
          ]
        }
      ]
    };
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }
  return vscode.Uri.file(configPath);
}
