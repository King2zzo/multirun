# Multirun

A VS Code extension that lets you **group and launch multiple debug configurations and terminal scripts simultaneously** — with a single click from the Activity Bar.

Stop juggling tabs and manually starting services one by one. Define your groups once in a simple JSON file and run everything in parallel or in sequence whenever you need it.

---

## Features

- **Run groups** of launch configurations and/or terminal scripts with one click
- **Parallel or sequential** execution per group, with optional delay between steps
- **Stop groups** — kill all debug sessions and terminals in a group at once
- **Live status indicators** — running entries are highlighted in the tree view
- **Environment variable support** — load from `.env` files or inline `env` map per script entry
- **Auto-reload** — the view updates automatically when you edit `multirun.json`
- **Visual config editor** — open the built-in webview to edit your groups without touching JSON

---

## Getting Started

1. Install the extension
2. Open the **Multirun** panel in the Activity Bar (rocket icon)
3. Click the **Edit Config** button to open `.vscode/multirun.json`
4. Define your groups and click **Run** ▶

---

## Configuration

Multirun reads from `.vscode/multirun.json` in your workspace root. A config file is created automatically with an example on first use.

```jsonc
{
  "version": "1.0.0",
  "groups": [
    {
      "name": "Full Stack",
      "sequential": false,
      "delay": 500,
      "configurations": [
        {
          "name": "Launch API",
          "type": "launch",
          "launchConfig": "Launch API"
        },
        {
          "name": "Frontend Dev Server",
          "type": "script",
          "command": "npm run dev",
          "cwd": "packages/frontend",
          "envFile": ".env.local",
          "env": {
            "NODE_ENV": "development"
          }
        }
      ]
    }
  ]
}
```

### Group options

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name shown in the tree view |
| `sequential` | `boolean` | Run entries one after another (`true`) or all at once (`false`) |
| `delay` | `number` | Milliseconds to wait between entries in sequential mode |
| `configurations` | `array` | List of launch or script entries |

### Entry options

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name and identifier for the entry |
| `type` | `"launch"` \| `"script"` | Launch a debug config or run a terminal command |
| `launchConfig` | `string` | Name of the entry in `.vscode/launch.json` (launch type only) |
| `command` | `string` | Shell command to run (script type only) |
| `cwd` | `string` | Working directory for the terminal (script type only) |
| `envFile` | `string` | Path to a `.env` file to load environment variables from |
| `env` | `object` | Inline environment variables (merged on top of `envFile`) |

---

## Commands

| Command | Description |
|---------|-------------|
| `Multirun: Refresh` | Reload the tree view |
| `Multirun: Run Group` | Start all entries in a group |
| `Multirun: Stop Group` | Stop all entries in a group |
| `Multirun: Edit Config` | Open the visual config editor |

---

## Requirements

- VS Code `^1.80.0`

---

## License

[MIT](LICENSE)
