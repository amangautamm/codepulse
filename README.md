<div align="center">

<img src="media/icon.png" width="128" height="128" alt="CodePulse Logo"/>

# ⚡ CodePulse

### Codebase Health & Activity Monitor for VS Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/amanblaze.codepulse?style=flat-square&color=00ff9d&label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=amanblaze.codepulse)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/amanblaze.codepulse?style=flat-square&color=3d8eff)](https://marketplace.visualstudio.com/items?itemName=amanblaze.codepulse)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/amanblaze.codepulse?style=flat-square&color=ff9a3c)](https://marketplace.visualstudio.com/items?itemName=amanblaze.codepulse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

**Real-time codebase intelligence. Zero AI. Zero internet. 100% local.**

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=amanblaze.codepulse) · [Report Bug](https://github.com/amangautamm/codepulse/issues) · [Request Feature](https://github.com/amangautamm/codepulse/issues) · [Sponsor ❤️](#sponsors--support)

</div>

---

## 📖 Table of Contents

- [Why CodePulse?](#-why-codepulse)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Installation](#-installation)
- [Usage](#-usage)
- [Commands](#-commands)
- [Settings](#-settings)
- [How It Works](#-how-it-works)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Sponsors & Support](#-sponsors--support)
- [License](#-license)

---

## 🤔 Why CodePulse?

Every developer faces this: you open a 6-month-old project and have **no idea** what's happening inside.

| Pain | Reality |
|------|---------|
| `// TODO: fix this` | Written 2 years ago, never fixed |
| `function processPayment()` | Complexity: 24, no one dares touch it |
| `import { utils }` | Imported everywhere, defined nowhere |
| Standup in 5 mins | "What did I work on today?" |

**CodePulse solves all of this — live, locally, automatically.**

> 📊 Microsoft study: Average codebase has **25–40% dead or risky code**
>
> 💸 McKinsey: Companies spend **40% of IT budget** fixing technical debt
>
> ⏱️ Stack Overflow: Developers spend **62% of time** understanding old code, not writing new code

---

## ✨ Features

### 🏥 Codebase Health

#### Cyclomatic Complexity Scoring
Every function in your codebase gets a real-time health score based on its cyclomatic complexity (number of decision paths).

```
🟢 1–5   Healthy     — clean, simple logic
🟡 6–9   Warning     — getting complex, watch it
🔴 10+   Critical    — refactor now
```

Inline diagnostics show directly in your editor — no need to open any panel.

#### Dead Code Detection
Finds code that exists but is never used:
- Unused `import` statements (named, default, namespace)
- Variables declared but never read
- Top-level functions defined but never called

Dead code is faded out with VS Code's `Unnecessary` tag — just like TypeScript does it.

#### Duplicate Code Detection
Uses **Rabin-Karp polynomial rolling hash** to detect duplicate blocks across all your files — no false positives, no heavy AST parsing.

```
src/auth.js:45   ─┐
src/utils.js:203 ─┴─ Same 8-line block
```

#### Circular Dependency Detection
Runs a full **DFS graph traversal** on your import graph to find circular dependency cycles:

```
A → B → C → A   ← 💀 This will crash your app eventually
```

---

### 📔 Developer Activity (CodeDiary)

Track exactly what you worked on, automatically:

| Metric | Tracked |
|--------|---------|
| Active coding time | Per file, per language |
| Lines added / deleted | Per file |
| Edit count | Per file |
| Save count | Per file |
| Language breakdown | TypeScript vs JS etc. |

**Export** a full Markdown report for:
- 📋 Daily standup prep
- 💰 Freelance invoice billing
- 📊 Project time logs
- 👨‍🏫 Student project journals

Data is stored **locally for 30 days**, then auto-pruned.

---

### 📊 Dashboard

A beautiful 5-tab webview dashboard:

| Tab | What you see |
|-----|-------------|
| 🏥 Health | File complexity table with health bars, score, LOC, critical functions |
| 📊 Activity | Coding time, language breakdown, file activity table |
| 💀 Dead Code | Files with unused imports/variables, issue count |
| 🔁 Duplicates | Duplicate blocks with file locations and code preview |
| 🔄 Circular Deps | Dependency cycles visualized as chains |

---

## 📸 Screenshots

> _Add screenshots here after installing_

| Dashboard — Health Tab | Sidebar — Live Tree |
|------------------------|---------------------|
| _(screenshot)_         | _(screenshot)_      |

---

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Press `Ctrl+Shift+X` (Extensions)
3. Search **"CodePulse"**
4. Click **Install**

### From VSIX (Manual)
```bash
code --install-extension codepulse-1.0.0.vsix
```

### From Source
```bash
git clone https://github.com/amangautamm/codepulse.git
cd codepulse
npm install
npm run compile
# Press F5 in VS Code to run Extension Development Host
```

---

## 🚀 Usage

1. **Open any JS/TS project** in VS Code
2. CodePulse **auto-analyzes on startup** (after 4 seconds)
3. Look for the **CodePulse icon** in the Activity Bar (left sidebar)
4. Check the **status bar** at the bottom: `⚡ CodePulse 87/100`
5. Press `Ctrl+Shift+P` → **CodePulse: Show Dashboard** for the full view

### First-time setup
Run **`CodePulse: Analyze Entire Workspace`** from the Command Palette for a full scan.

---

## ⌨️ Commands

| Command | Description |
|---------|-------------|
| `CodePulse: Show Dashboard` | Open full 5-tab dashboard |
| `CodePulse: Analyze Entire Workspace` | Scan all JS/TS files |
| `CodePulse: Analyze Current File` | Analyze only the open file |
| `CodePulse: Show Activity Report` | Jump to Activity tab |
| `CodePulse: Export Activity Log` | Save Markdown report |
| `CodePulse: Clear Activity Data` | Reset today's tracking |

---

## ⚙️ Settings

Open `Settings` → search **"codepulse"**

| Setting | Default | Description |
|---------|---------|-------------|
| `codepulse.complexityWarningThreshold` | `6` | Yellow warning level |
| `codepulse.complexityCriticalThreshold` | `10` | Red critical level |
| `codepulse.enableDeadCodeDetection` | `true` | Toggle dead code hints |
| `codepulse.enableDuplicateDetection` | `true` | Toggle duplicate detection |
| `codepulse.duplicateMinLines` | `5` | Min lines for a duplicate block |
| `codepulse.enableActivityTracking` | `true` | Toggle activity tracking |
| `codepulse.activityIdleTimeoutMinutes` | `5` | Idle minutes before session pauses |
| `codepulse.autoAnalyzeOnSave` | `true` | Re-analyze when file is saved |
| `codepulse.excludePatterns` | `["**/node_modules/**", ...]` | Files/folders to skip |

### Example custom config (`settings.json`)
```json
{
  "codepulse.complexityWarningThreshold": 8,
  "codepulse.complexityCriticalThreshold": 15,
  "codepulse.duplicateMinLines": 6,
  "codepulse.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/coverage/**",
    "**/*.test.ts"
  ]
}
```

---

## 🔬 How It Works

All analysis runs **100% locally** — no internet, no AI, no telemetry.

### Complexity Analysis
Uses **cyclomatic complexity** — counts the number of linearly independent paths through a function. Every `if`, `for`, `while`, `case`, `&&`, `||`, `??`, and ternary adds +1 to the score. Based on Thomas J. McCabe's 1976 metric, still the industry standard.

### Duplicate Detection
Implements a **polynomial rolling hash (Rabin-Karp style)** over normalized lines:
1. Strip comments and normalize whitespace
2. Slide a window of N lines across the file
3. Hash each window
4. Any hash appearing 2+ times = duplicate block

### Dead Code Detection
Simple but effective **text-based occurrence counting** after comment stripping:
1. Find all `import`, `const/let/var`, `function` declarations
2. Count usages of each identifier in the rest of the file
3. Zero usages = dead code

### Circular Dependencies
Builds an **adjacency graph** from `import`/`require` statements, then runs **iterative DFS** with a visited-set and stack-set to detect back-edges (cycles). Deduplicates cycles by sorting node keys.

### Activity Tracking
Hooks into VS Code's `onDidChangeTextDocument`, `onDidChangeActiveTextEditor`, and `onDidSaveTextDocument` events. Tracks elapsed time with an idle-timeout guard. All data stored in VS Code's `globalState` (local SQLite).

---

## 🗺️ Roadmap

- [ ] **Python support** — complexity + dead code for `.py` files
- [ ] **Weekly/Monthly activity report** — beyond just today
- [ ] **Git blame integration** — show how old each risky function is
- [ ] **Team mode** — aggregate reports via shared folder (no server)
- [ ] **Complexity trend chart** — is your codebase getting better or worse?
- [ ] **Quick Fix** — one-click remove dead imports
- [ ] **Heatmap view** — color-coded file tree by health score

---

## 🤝 Contributing

Contributions are what make open source amazing. Any contribution is **greatly appreciated**.

1. Fork the repo
2. Create your branch: `git checkout -b feature/AmazingFeature`
3. Commit: `git commit -m 'Add AmazingFeature'`
4. Push: `git push origin feature/AmazingFeature`
5. Open a **Pull Request**

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/amangautamm/codepulse.git
cd codepulse
npm install
npm run watch       # TypeScript watch mode
# Press F5 in VS Code → Extension Development Host opens
```

---

## ❤️ Sponsors & Support

CodePulse is free and open source. If it saves you time, please consider supporting:

### Sponsor this project

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink?style=flat-square&logo=github)](https://github.com/sponsors/amangautamm)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-☕-yellow?style=flat-square)](https://buymeacoffee.com/amanblaze)

### Other ways to help
- ⭐ **Star this repo** — helps others find it
- 🐛 **Report bugs** — [open an issue](https://github.com/amangautamm/codepulse/issues)
- 💬 **Share** — tweet about it, post on Dev.to
- 📝 **Review** — leave a [Marketplace review](https://marketplace.visualstudio.com/items?itemName=amanblaze.codepulse&ssr=false#review-details)

### Current Sponsors

_Be the first sponsor! Your name/logo here._

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<div align="center">

Made with ❤️ by [Aman Gautam](https://github.com/amangautamm)

⭐ If CodePulse helped you — please star the repo!

</div>
