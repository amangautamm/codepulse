# Changelog

All notable changes to CodePulse are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Python language support
- Weekly/monthly activity reports
- Git blame integration (show function age)
- Quick Fix for dead imports
- Complexity trend chart over time

---

## [1.0.0] — 2024-03-08

### Added

#### Codebase Health
- **Cyclomatic Complexity Analyzer** — function-level scoring with healthy/warning/critical levels
- **Dead Code Detector** — unused named imports, default imports, namespace imports, variables, top-level functions
- **Duplicate Code Detection** — Rabin-Karp polynomial rolling hash, configurable minimum block size
- **Circular Dependency Analyzer** — full DFS graph traversal with cycle deduplication

#### Developer Activity (CodeDiary)
- File session tracking — active time, lines added/deleted, edit count, save count
- Language breakdown — time spent per language (TypeScript, JavaScript, etc.)
- 30-day data retention with automatic pruning of old records
- Export to Markdown report — perfect for standups, billing, project logs

#### UI
- **5-tab Dashboard** — Health, Activity, Dead Code, Duplicates, Circular Deps
- **Sidebar Health Tree** — real-time file scores with expand/collapse
- **Sidebar Activity Tree** — today's top files, language breakdown
- **Status Bar indicator** — live health score `⚡ CodePulse 87/100`
- **Progress notification** — "Analyzing workspace…" during full scan

#### Developer Experience
- Inline diagnostics — complexity warnings and dead code hints directly in editor
- Batched workspace analysis — 10 files per batch to keep UI responsive
- Auto-analysis on file save (configurable)
- 4-second startup delay to avoid slowing VS Code launch
- Content Security Policy on all webviews

#### Configuration
- `complexityWarningThreshold` — default 6
- `complexityCriticalThreshold` — default 10
- `enableDeadCodeDetection` — default true
- `enableDuplicateDetection` — default true
- `duplicateMinLines` — default 5
- `enableActivityTracking` — default true
- `activityIdleTimeoutMinutes` — default 5
- `autoAnalyzeOnSave` — default true
- `excludePatterns` — default excludes node_modules, dist, out, build, .git, *.min.js, *.d.ts

### Technical
- TypeScript strict mode compilation
- Zero external runtime dependencies
- Zero internet, zero AI, zero telemetry
- All data stored in VS Code globalState (local SQLite)
