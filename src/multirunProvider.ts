import * as vscode from 'vscode';
import { loadConfig, MultirunGroup, ConfigEntry } from './configLoader';

export class GroupItem extends vscode.TreeItem {
  constructor(public readonly group: MultirunGroup) {
    super(group.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'group';
    this.iconPath = new vscode.ThemeIcon('run-all');
    this.description = group.sequential ? 'sequential' : 'parallel';
    this.tooltip = new vscode.MarkdownString(
      `**Mode:** ${group.sequential ? 'Sequential' : 'Parallel'}  \n` +
      (group.delay !== undefined ? `**Delay:** ${group.delay}ms  \n` : '') +
      `**Configurations:**  \n` +
      group.configurations.map(c => `- ${c.name}`).join('  \n')
    );
  }
}

export class ConfigItem extends vscode.TreeItem {
  constructor(public readonly entry: ConfigEntry, isActive: boolean) {
    super(entry.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'config';
    if (entry.type === 'script') {
      this.iconPath = new vscode.ThemeIcon(
        isActive ? 'terminal' : 'terminal-bash',
        isActive ? new vscode.ThemeColor('debugIcon.startForeground') : undefined
      );
      this.description = entry.command || '';
      this.tooltip = entry.cwd ? `cwd: ${entry.cwd}` : entry.command;
    } else {
      this.iconPath = new vscode.ThemeIcon(
        isActive ? 'debug-start' : 'debug-alt',
        isActive ? new vscode.ThemeColor('debugIcon.startForeground') : undefined
      );
      this.description = isActive ? 'running' : (entry.launchConfig || '');
    }
  }
}

export class MultirunProvider
  implements vscode.TreeDataProvider<GroupItem | ConfigItem>
{
  private _onDidChangeTreeData =
    new vscode.EventEmitter<GroupItem | ConfigItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private readonly configSessionMap: Map<string, vscode.DebugSession>,
    private readonly configTerminalMap: Map<string, vscode.Terminal>
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: GroupItem | ConfigItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GroupItem | ConfigItem): (GroupItem | ConfigItem)[] {
    if (!element) {
      const config = loadConfig();
      return config.groups.map(g => new GroupItem(g));
    }
    if (element instanceof GroupItem) {
      return element.group.configurations.map(entry => {
        const isActive =
          entry.type === 'script'
            ? this.configTerminalMap.has(entry.name)
            : this.configSessionMap.has(entry.name);
        return new ConfigItem(entry, isActive);
      });
    }
    return [];
  }
}
