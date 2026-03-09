# Contributing to CodePulse

First off — **thank you** for taking the time to contribute! 🎉

## Code of Conduct

Be respectful. Be kind. Zero tolerance for harassment. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## How to Contribute

### 🐛 Reporting Bugs

1. Check [existing issues](https://github.com/YOUR_USERNAME/codepulse/issues) first
2. Open a **new issue** with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - VS Code version + OS

### 💡 Requesting Features

Open an issue with the `enhancement` label. Describe:
- The problem you're solving
- Your proposed solution
- Why it benefits others

### 🔧 Submitting Code

#### Setup
```bash
git clone https://github.com/YOUR_USERNAME/codepulse.git
cd codepulse
npm install
npm run watch
```

Press **F5** in VS Code to open Extension Development Host.

#### Branch naming
```
feature/your-feature-name
fix/bug-description
docs/what-you-updated
```

#### Commit messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add Python language support
fix: circular dep false positive on re-exports
docs: update settings table in README
refactor: extract hash function to utils
```

#### Pull Request checklist
- [ ] Code compiles without errors (`npm run compile`)
- [ ] Tested in Extension Development Host
- [ ] README updated if new feature/setting added
- [ ] CHANGELOG.md updated

## Project Structure

```
codepulse/
├── src/
│   ├── extension.ts              ← Entry point, command registration
│   ├── utils/
│   │   └── config.ts             ← Settings access layer
│   ├── analyzers/
│   │   ├── complexityAnalyzer.ts ← Cyclomatic complexity
│   │   ├── deadCodeAnalyzer.ts   ← Unused code detection
│   │   ├── duplicateAnalyzer.ts  ← Rabin-Karp hash matching
│   │   └── circularDepAnalyzer.ts← DFS dependency graph
│   ├── activity/
│   │   └── activityTracker.ts    ← CodeDiary session tracking
│   ├── providers/
│   │   ├── healthTreeProvider.ts ← Sidebar health tree
│   │   └── activityTreeProvider.ts← Sidebar activity tree
│   ├── panels/
│   │   └── dashboardPanel.ts     ← 5-tab webview dashboard
│   └── diagnostics/
│       └── diagnosticsManager.ts ← VS Code diagnostic collections
├── media/
│   ├── icon.png                  ← Extension icon (128x128)
│   └── sidebar-icon.svg          ← Activity bar icon
├── out/                          ← Compiled JS (auto-generated)
├── test/                         ← Unit tests
└── package.json
```

## Adding a New Analyzer

1. Create `src/analyzers/myAnalyzer.ts`
2. Export a class with `analyze(document: vscode.TextDocument): MyResult`
3. Register it in `extension.ts`
4. Add diagnostics in `DiagnosticsManager.analyzeDocument()`
5. Add a tree view node in `HealthTreeProvider`
6. Add a dashboard tab in `DashboardPanel`

## Questions?

Open a [Discussion](https://github.com/YOUR_USERNAME/codepulse/discussions) — not an issue.
