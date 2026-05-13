import * as vscode from 'vscode';
import { MultirunProvider, GroupItem } from './multirunProvider';
import { runGroup, stopGroup, runEntry, stopEntry } from './runner';
import { ensureConfigExists, getConfigPath, loadConfig } from './configLoader';
import { ConfigWebview } from './configWebview';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext): void {
  // Tracks active debug sessions by configuration name
  const configSessionMap = new Map<string, vscode.DebugSession>();
  // Tracks active terminals by configuration name (script type)
  const configTerminalMap = new Map<string, vscode.Terminal>();

  const provider = new MultirunProvider(configSessionMap, configTerminalMap);

  // Register tree view
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('multirunView', provider)
  );

  // Track debug session lifecycle
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession(session => {
      configSessionMap.set(session.name, session);
      provider.refresh();
    }),
    vscode.debug.onDidTerminateDebugSession(session => {
      configSessionMap.delete(session.name);
      provider.refresh();
    })
  );

  // Track terminal lifecycle
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal(terminal => {
      for (const [name, t] of configTerminalMap) {
        if (t === terminal) {
          configTerminalMap.delete(name);
          provider.refresh();
          break;
        }
      }
    })
  );

  // Watch .vscode/multirun.json for changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/multirun.json');
  context.subscriptions.push(
    watcher,
    watcher.onDidChange(() => provider.refresh()),
    watcher.onDidCreate(() => provider.refresh()),
    watcher.onDidDelete(() => provider.refresh())
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('multirun.refresh', () => {
      provider.refresh();
    }),

    vscode.commands.registerCommand('multirun.runGroup', async (item: GroupItem) => {
      if (!item?.group) {
        vscode.window.showErrorMessage('Multirun: No group selected.');
        return;
      }
      await runGroup(item.group, configSessionMap, configTerminalMap);
      provider.refresh();
    }),

    vscode.commands.registerCommand('multirun.stopGroup', async (item: GroupItem) => {
      if (!item?.group) {
        vscode.window.showErrorMessage('Multirun: No group selected.');
        return;
      }
      await stopGroup(item.group, configSessionMap, configTerminalMap);
      provider.refresh();
    }),

    vscode.commands.registerCommand('multirun.editConfig', async () => {
      const uri = await ensureConfigExists();
      if (uri) {
        await vscode.window.showTextDocument(uri);
      }
    }),

    vscode.commands.registerCommand('multirun.openUI', () => {
      ConfigWebview.open(context);
    }),

    vscode.commands.registerCommand('multirun.runEntry', async (item: import('./multirunProvider').ConfigItem) => {
      if (!item?.entry) {
        vscode.window.showErrorMessage('Multirun: No configuration selected.');
        return;
      }
      await runEntry(item.entry, configSessionMap, configTerminalMap);
      provider.refresh();
    }),

    vscode.commands.registerCommand('multirun.stopEntry', async (item: import('./multirunProvider').ConfigItem) => {
      if (!item?.entry) {
        vscode.window.showErrorMessage('Multirun: No configuration selected.');
        return;
      }
      await stopEntry(item.entry, configSessionMap, configTerminalMap);
      provider.refresh();
    })
  );

  // Auto-open UI if no config exists yet in this workspace
  const configPath = getConfigPath();
  if (configPath && !fs.existsSync(configPath)) {
    // Small delay so the sidebar renders first
    setTimeout(() => ConfigWebview.open(context), 800);
  }
}
export function deactivate(): void {}
