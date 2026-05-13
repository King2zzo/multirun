import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MultirunGroup, ConfigEntry } from './configLoader';

/** Parse a .env file into a key-value map. Skips comments and empty lines. */
function parseEnvFile(envFilePath: string, cwd?: string): Record<string, string> {
  const resolved = path.isAbsolute(envFilePath)
    ? envFilePath
    : path.join(cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', envFilePath);
  if (!fs.existsSync(resolved)) {
    vscode.window.showWarningMessage(`Multirun: .env file not found: ${resolved}`);
    return {};
  }
  const result: Record<string, string> = {};
  const lines = fs.readFileSync(resolved, 'utf-8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) { continue; }
    const eq = line.indexOf('=');
    if (eq === -1) { continue; }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) { result[key] = value; }
  }
  return result;
}

export async function runGroup(
  group: MultirunGroup,
  configSessionMap: Map<string, vscode.DebugSession>,
  configTerminalMap: Map<string, vscode.Terminal>
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage('Multirun: No workspace folder found.');
    return;
  }
  if (group.configurations.length === 0) {
    vscode.window.showWarningMessage(`Multirun: Group "${group.name}" has no configurations.`);
    return;
  }

  vscode.window.showInformationMessage(
    `Multirun: Starting "${group.name}" (${group.sequential ? 'sequential' : 'parallel'})...`
  );

  if (group.sequential) {
    await runSequential(folder, group, configSessionMap, configTerminalMap);
  } else {
    await runParallel(folder, group, configSessionMap, configTerminalMap);
  }
}

async function runSequential(
  folder: vscode.WorkspaceFolder,
  group: MultirunGroup,
  configSessionMap: Map<string, vscode.DebugSession>,
  configTerminalMap: Map<string, vscode.Terminal>
): Promise<void> {
  const delay = group.delay ?? 0;
  for (const entry of group.configurations) {
    const started = await startEntry(folder, entry, configSessionMap, configTerminalMap);
    if (!started) { return; }
    if (delay > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }
}

async function runParallel(
  folder: vscode.WorkspaceFolder,
  group: MultirunGroup,
  configSessionMap: Map<string, vscode.DebugSession>,
  configTerminalMap: Map<string, vscode.Terminal>
): Promise<void> {
  await Promise.all(
    group.configurations.map(e => startEntry(folder, e, configSessionMap, configTerminalMap))
  );
}

async function startEntry(
  folder: vscode.WorkspaceFolder,
  entry: ConfigEntry,
  configSessionMap: Map<string, vscode.DebugSession>,
  configTerminalMap: Map<string, vscode.Terminal>
): Promise<boolean> {
  return entry.type === 'script'
    ? startScript(entry, configTerminalMap)
    : startLaunch(folder, entry, configSessionMap);
}

async function startLaunch(
  folder: vscode.WorkspaceFolder,
  entry: ConfigEntry,
  configSessionMap: Map<string, vscode.DebugSession>
): Promise<boolean> {
  const configName = entry.launchConfig ?? entry.name;
  const existing = configSessionMap.get(entry.name);
  if (existing) {
    await vscode.debug.stopDebugging(existing);
  }
  const success = await vscode.debug.startDebugging(folder, configName);
  if (!success) {
    vscode.window.showErrorMessage(`Multirun: Failed to start launch config "${configName}".`);
  }
  return success;
}

function startScript(
  entry: ConfigEntry,
  configTerminalMap: Map<string, vscode.Terminal>
): boolean {
  if (!entry.command) {
    vscode.window.showErrorMessage(`Multirun: No command set for script "${entry.name}".`);
    return false;
  }
  // Dispose existing terminal with the same name
  configTerminalMap.get(entry.name)?.dispose();

  // Merge: envFile vars first, then inline env (inline takes priority)
  const fileVars = entry.envFile ? parseEnvFile(entry.envFile, entry.cwd) : {};
  const mergedEnv = { ...fileVars, ...(entry.env ?? {}) };

  const terminal = vscode.window.createTerminal({
    name: entry.name,
    cwd: entry.cwd || undefined,
    env: Object.keys(mergedEnv).length > 0 ? mergedEnv : undefined
  });
  terminal.sendText(entry.command);
  terminal.show(true);
  configTerminalMap.set(entry.name, terminal);
  return true;
}

export async function stopGroup(
  group: MultirunGroup,
  configSessionMap: Map<string, vscode.DebugSession>,
  configTerminalMap: Map<string, vscode.Terminal>
): Promise<void> {
  let stopped = 0;

  for (const entry of group.configurations) {
    if (entry.type === 'script') {
      const term = configTerminalMap.get(entry.name);
      if (term) {
        term.sendText('\x03'); // Ctrl+C — graceful stop
        configTerminalMap.delete(entry.name);
        stopped++;
      }
    } else {
      const session = configSessionMap.get(entry.name);
      if (session) {
        await vscode.debug.stopDebugging(session);
        stopped++;
      }
    }
  }

  if (stopped === 0) {
    vscode.window.showInformationMessage(`Multirun: No active sessions for group "${group.name}".`);
  } else {
    vscode.window.showInformationMessage(`Multirun: Stopped group "${group.name}".`);
  }
}

export async function runEntry(
  entry: ConfigEntry,
  configSessionMap: Map<string, vscode.DebugSession>,
  configTerminalMap: Map<string, vscode.Terminal>
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage('Multirun: No workspace folder found.');
    return;
  }
  await startEntry(folder, entry, configSessionMap, configTerminalMap);
}

export async function stopEntry(
  entry: ConfigEntry,
  configSessionMap: Map<string, vscode.DebugSession>,
  configTerminalMap: Map<string, vscode.Terminal>
): Promise<void> {
  if (entry.type === 'script') {
    const term = configTerminalMap.get(entry.name);
    if (term) {
      term.sendText('\x03');
      configTerminalMap.delete(entry.name);
    } else {
      vscode.window.showInformationMessage(`Multirun: "${entry.name}" is not running.`);
    }
  } else {
    const session = configSessionMap.get(entry.name);
    if (session) {
      await vscode.debug.stopDebugging(session);
    } else {
      vscode.window.showInformationMessage(`Multirun: "${entry.name}" is not running.`);
    }
  }
}
