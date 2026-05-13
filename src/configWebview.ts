import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, getConfigPath, MultirunConfig } from './configLoader';

export class ConfigWebview {
  private static panel: vscode.WebviewPanel | undefined;

  static open(context: vscode.ExtensionContext): void {
    if (ConfigWebview.panel) {
      ConfigWebview.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'multirunConfig',
      'Multirun Configuration',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    ConfigWebview.panel = panel;
    panel.webview.html = ConfigWebview.buildHtml();

    // Send current config to webview
    panel.webview.postMessage({ type: 'init', config: loadConfig() });

    panel.webview.onDidReceiveMessage(async (msg: { type: string; config?: MultirunConfig; id?: string; kind?: string }) => {
      if (msg.type === 'save') {
        const configPath = getConfigPath();
        if (!configPath || !msg.config) { return; }
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(msg.config, null, 2), 'utf-8');
        vscode.window.showInformationMessage('Multirun: Configuration saved.');
      } else if (msg.type === 'browse') {
        if (msg.kind === 'env') {
          const result = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: 'Select .env file'
          });
          if (result?.[0]) {
            panel.webview.postMessage({ type: 'browseResult', id: msg.id, kind: 'env', value: result[0].fsPath });
          }
        } else {
          const result = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Working Directory'
          });
          if (result?.[0]) {
            panel.webview.postMessage({ type: 'browseResult', id: msg.id, kind: 'cwd', value: result[0].fsPath });
          }
        }
      }
    }, undefined, context.subscriptions);

    panel.onDidDispose(() => { ConfigWebview.panel = undefined; });
  }

  private static buildHtml(): string {
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  padding: 20px;
  max-width: 860px;
}
h2 { margin-bottom: 16px; font-weight: 600; }
.toolbar { display: flex; gap: 8px; margin-bottom: 20px; align-items: center; }
#status { margin-left: auto; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none; padding: 4px 12px; border-radius: 3px;
  cursor: pointer; font-size: var(--vscode-font-size); font-family: var(--vscode-font-family);
}
button:hover { background: var(--vscode-button-hoverBackground); }
button.sec { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
button.sec:hover { background: var(--vscode-button-secondaryHoverBackground); }
button.del { background: transparent; color: var(--vscode-errorForeground); border: 1px solid var(--vscode-inputValidation-errorBorder); padding: 2px 8px; }
button.del:hover { background: var(--vscode-inputValidation-errorBackground); }
.card { border: 1px solid var(--vscode-panel-border); border-radius: 4px; margin-bottom: 12px; }
.card-head {
  background: var(--vscode-sideBar-background);
  padding: 8px 12px; display: flex; gap: 8px; align-items: center;
}
.caret { cursor: pointer; user-select: none; width: 16px; flex-shrink: 0; display: inline-block; transition: transform 0.15s; }
.card-body { padding: 12px; }
.card.collapsed .card-body { display: none; }
.card.collapsed > .card-head > .caret { transform: rotate(-90deg); }
label { font-size: 0.85em; color: var(--vscode-descriptionForeground); white-space: nowrap; }
input[type=text], input[type=number], select {
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border, #555);
  padding: 3px 7px; border-radius: 3px;
  font-size: var(--vscode-font-size); font-family: var(--vscode-font-family);
}
input[type=text] { flex: 1; min-width: 100px; }
input[type=number] { width: 76px; }
input[type=checkbox] { cursor: pointer; accent-color: var(--vscode-focusBorder); }
.row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.entry { border: 1px solid var(--vscode-panel-border); border-radius: 3px; margin-bottom: 6px; background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background)); }
.entry-head { padding: 6px 10px; display: flex; gap: 8px; align-items: center; }
.entry-body { padding: 8px 12px; border-top: 1px solid var(--vscode-panel-border); }
.entry.collapsed .entry-body { display: none; }
.entry.collapsed > .entry-head > .caret { transform: rotate(-90deg); }
.env-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
.env-table td { padding: 2px 4px; }
.env-table td:first-child, .env-table td:nth-child(2) { width: 50%; }
.env-table td:last-child { width: 36px; }
.env-table input[type=text] { width: 100%; }
.sec-title { font-size: 0.8em; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.05em; margin: 10px 0 4px; }
</style>
</head>
<body>
<h2>Multirun Configuration</h2>
<div class="toolbar">
  <button onclick="save()">Save</button>
  <button class="sec" onclick="addGroup()">+ Add Group</button>
  <span id="status"></span>
</div>
<div id="root"></div>

<script>
const vscode = acquireVsCodeApi();
let cfg = { version: '1.0.0', groups: [] };

window.addEventListener('message', ev => {
  const m = ev.data;
  if (m.type === 'init') { cfg = m.config; render(); }
  if (m.type === 'browseResult') {
    if (m.kind === 'cwd') {
      const el = document.querySelector('[data-cwd="' + m.id + '"]');
      if (el) { el.value = m.value; sync(); }
    } else if (m.kind === 'env') {
      const el = document.querySelector('[data-envfile="' + m.id + '"]');
      if (el) { el.value = m.value; sync(); }
    }
  }
});

// ─── Render ────────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById('root');
  root.innerHTML = '';
  (cfg.groups || []).forEach((g, gi) => root.appendChild(mkGroup(g, gi)));
}

function mkGroup(g, gi) {
  const card = el('div', { className: 'card', 'data-gi': gi });

  // Header
  const head = el('div', { className: 'card-head' });
  head.append(
    caret(card),
    inp(g.name, { 'data-f': 'gname', 'data-gi': gi, placeholder: 'Group name', style: 'flex:1;font-weight:600' }),
    lbl('Sequential', chk(g.sequential, { 'data-f': 'gseq', 'data-gi': gi })),
    lbl('Delay', num(g.delay ?? 0, { 'data-f': 'gdelay', 'data-gi': gi }), 'ms'),
    btn('Remove group', () => { sync(); cfg.groups.splice(gi, 1); render(); }, 'del')
  );

  // Body
  const body = el('div', { className: 'card-body' });
  const list = el('div');
  (g.configurations || []).forEach((e, ei) => list.appendChild(mkEntry(e, gi, ei)));

  const addBtn = btn('+ Add Configuration', () => {
    sync();
    cfg.groups[gi].configurations.push({ name: 'New Config', type: 'launch', launchConfig: '' });
    render();
  }, 'sec');
  addBtn.style.marginTop = '8px';

  body.append(list, addBtn);
  card.append(head, body);
  return card;
}

function mkEntry(e, gi, ei) {
  const uid = gi + '-' + ei;
  const isScript = e.type === 'script';
  const card = el('div', { className: 'entry', 'data-gi': gi, 'data-ei': ei });

  const typeSelect = sel(
    [['launch', 'Launch Config (launch.json)'], ['script', 'Script (terminal)']],
    e.type || 'launch',
    { 'data-f': 'etype', 'data-gi': gi, 'data-ei': ei }
  );
  typeSelect.onchange = () => {
    sync();
    cfg.groups[gi].configurations[ei].type = typeSelect.value;
    render();
  };

  // Entry header
  const head = el('div', { className: 'entry-head' });
  head.append(
    caret(card, true),
    inp(e.name || '', { 'data-f': 'ename', 'data-gi': gi, 'data-ei': ei, placeholder: 'Display name', style: 'flex:1' }),
    typeSelect,
    btn('✕', () => { sync(); cfg.groups[gi].configurations.splice(ei, 1); render(); }, 'del')
  );

  // Entry body
  const body = el('div', { className: 'entry-body' });

  if (isScript) {
    const cwdInput = inp(e.cwd || '', { 'data-f': 'cwd', 'data-gi': gi, 'data-ei': ei, placeholder: '/path/to/project', 'data-cwd': uid });
    const envFileInput = inp(e.envFile || '', { 'data-f': 'envfile', 'data-gi': gi, 'data-ei': ei, placeholder: '/path/to/.env or relative .env', 'data-envfile': uid });
    body.append(
      row(
        lbl('Working directory'),
        cwdInput,
        btn('Browse…', () => vscode.postMessage({ type: 'browse', kind: 'cwd', id: uid }), 'sec')
      ),
      row(lbl('Command'), inp(e.command || '', { 'data-f': 'cmd', 'data-gi': gi, 'data-ei': ei, placeholder: 'npm run dev' }))
    );

    const envTitle = el('div', { className: 'sec-title', textContent: 'Environment Variables' });
    body.append(envTitle);
    const envFileRow = row(
      lbl('.env file'),
      envFileInput,
      btn('Browse…', () => vscode.postMessage({ type: 'browse', kind: 'env', id: uid }), 'sec')
    );
    const envHint = el('div', { textContent: 'ℹ️ macOS: press ⌘⇧. in the picker to show hidden files', style: 'font-size:0.8em;color:var(--vscode-descriptionForeground);margin-bottom:8px;' });
    body.append(envFileRow, envHint);

    const tbl = el('table', { className: 'env-table' });
    Object.entries(e.env || {}).forEach(([k, v], idx) => tbl.appendChild(mkEnvRow(k, String(v), gi, ei, idx)));

    const addEnvBtn = btn('+ Add Variable', () => {
      sync();
      const en = cfg.groups[gi].configurations[ei];
      if (!en.env) { en.env = {}; }
      en.env['NEW_VAR_' + Date.now()] = '';
      render();
    }, 'sec');
    addEnvBtn.style.marginTop = '4px';

    body.append(tbl, addEnvBtn);
  } else {
    body.append(
      row(
        lbl('Launch config name'),
        inp(e.launchConfig || '', { 'data-f': 'lc', 'data-gi': gi, 'data-ei': ei, placeholder: 'Launch Program' })
      )
    );
  }

  card.append(head, body);
  return card;
}

function mkEnvRow(k, v, gi, ei, idx) {
  const tr = el('tr');
  const tdK = el('td'); tdK.appendChild(inp(k, { 'data-f': 'ekey', 'data-gi': gi, 'data-ei': ei, 'data-idx': idx, placeholder: 'KEY' }));
  const tdV = el('td'); tdV.appendChild(inp(v, { 'data-f': 'eval', 'data-gi': gi, 'data-ei': ei, 'data-idx': idx, placeholder: 'value' }));
  const tdD = el('td');
  tdD.appendChild(btn('✕', () => {
    sync();
    const keys = Object.keys(cfg.groups[gi].configurations[ei].env || {});
    if (keys[idx]) { delete cfg.groups[gi].configurations[ei].env[keys[idx]]; }
    render();
  }, 'del'));
  tr.append(tdK, tdV, tdD);
  return tr;
}

// ─── Sync DOM → config ─────────────────────────────────────────────────────
function sync() {
  cfg.groups = Array.from(document.querySelectorAll('.card[data-gi]')).map(card => {
    const gi = +card.dataset.gi;
    const g = f => { const e = card.querySelector('[data-f="'+f+'"][data-gi="'+gi+'"]'); return e ? (e.type==='checkbox' ? e.checked : e.value) : ''; };

    const configurations = Array.from(card.querySelectorAll('.entry[data-gi="'+gi+'"]')).map(ec => {
      const ei = +ec.dataset.ei;
      const v = (field) => { const e = ec.querySelector('[data-f="'+field+'"][data-gi="'+gi+'"][data-ei="'+ei+'"]'); return e ? (e.type==='checkbox'?e.checked:e.value) : ''; };
      const type = v('etype') || 'launch';
      if (type === 'script') {
        const env = {};
        const keys = ec.querySelectorAll('[data-f=ekey][data-gi="'+gi+'"][data-ei="'+ei+'"]');
        const vals = ec.querySelectorAll('[data-f=eval][data-gi="'+gi+'"][data-ei="'+ei+'"]');
        keys.forEach((k, i) => { const key = k.value.trim(); if (key) { env[key] = vals[i]?.value ?? ''; } });
        const envFile = v('envfile');
        return { name: v('ename'), type: 'script', cwd: v('cwd'), command: v('cmd'), envFile: envFile || undefined, env };
      }
      return { name: v('ename'), type: 'launch', launchConfig: v('lc') || v('ename') };
    });

    return { name: g('gname'), sequential: g('gseq'), delay: parseInt(g('gdelay')) || 0, configurations };
  });
}

function save() {
  sync();
  vscode.postMessage({ type: 'save', config: cfg });
  const s = document.getElementById('status');
  s.textContent = 'Saved \u2713';
  setTimeout(() => { s.textContent = ''; }, 2000);
}

function addGroup() {
  cfg.groups.push({ name: 'New Group', sequential: false, delay: 0, configurations: [] });
  render();
}

// ─── DOM helpers ───────────────────────────────────────────────────────────
function el(tag, props = {}) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') { e.className = String(v); }
    else if (k === 'textContent') { e.textContent = String(v); }
    else if (k === 'style') { e.style.cssText = String(v); }
    else { e.setAttribute(k, String(v)); }
  }
  return e;
}

function inp(val, attrs = {}) {
  const e = el('input', { type: 'text', ...attrs });
  e.value = val;
  e.addEventListener('input', sync);
  return e;
}
function num(val, attrs = {}) {
  const e = el('input', { type: 'number', ...attrs });
  e.value = String(val);
  e.addEventListener('input', sync);
  return e;
}
function chk(checked, attrs = {}) {
  const e = el('input', { type: 'checkbox', ...attrs });
  e.checked = !!checked;
  e.addEventListener('change', sync);
  return e;
}
function sel(options, val, attrs = {}) {
  const e = el('select', attrs);
  options.forEach(([v, t]) => {
    const opt = el('option', { value: v, textContent: t });
    if (v === val) { opt.selected = true; }
    e.appendChild(opt);
  });
  return e;
}
function btn(text, onclick, cls = '') {
  const b = el('button', { textContent: text, className: cls });
  b.onclick = onclick;
  return b;
}
function lbl(...children) {
  const l = el('label');
  l.style.cssText = 'display:flex;gap:4px;align-items:center';
  children.forEach(c => typeof c === 'string' ? l.append(document.createTextNode(c)) : l.appendChild(c));
  return l;
}
function row(...children) {
  const d = el('div', { className: 'row' });
  children.forEach(c => d.appendChild(c));
  return d;
}
function caret(target, isEntry = false) {
  const s = el('span', { className: 'caret', textContent: '\u25BE' });
  s.onclick = () => target.classList.toggle('collapsed');
  return s;
}
</script>
</body>
</html>`;
  }
}
