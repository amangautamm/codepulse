import * as vscode from 'vscode';
import { ComplexityAnalyzer } from './analyzers/complexityAnalyzer';
import { DeadCodeAnalyzer } from './analyzers/deadCodeAnalyzer';
import { DuplicateAnalyzer } from './analyzers/duplicateAnalyzer';
import { CircularDepAnalyzer } from './analyzers/circularDepAnalyzer';
import { ActivityTracker } from './activity/activityTracker';
import { HealthTreeProvider } from './providers/healthTreeProvider';
import { ActivityTreeProvider } from './providers/activityTreeProvider';
import { DashboardPanel } from './panels/dashboardPanel';
import { DiagnosticsManager } from './diagnostics/diagnosticsManager';
import { buildExcludeGlob, getConfig } from './utils/config';

let activityTracker: ActivityTracker;
let diagManager: DiagnosticsManager;

const SUPPORTED_RE = /\.(ts|tsx|js|jsx)$/;

export function activate(ctx: vscode.ExtensionContext): void {

    // ── Core components ──────────────────────────────────────
    const ca   = new ComplexityAnalyzer();
    const da   = new DeadCodeAnalyzer();
    const dupa = new DuplicateAnalyzer();
    const cda  = new CircularDepAnalyzer();
    diagManager    = new DiagnosticsManager(ctx);
    activityTracker = new ActivityTracker(ctx);

    // ── Tree views ───────────────────────────────────────────
    const healthProv   = new HealthTreeProvider(ca, da, dupa, cda);
    const activityProv = new ActivityTreeProvider(activityTracker);

    const healthTree = vscode.window.createTreeView('codepulse.healthView', {
        treeDataProvider: healthProv,
        showCollapseAll: true,
    });
    const activityTree = vscode.window.createTreeView('codepulse.activityView', {
        treeDataProvider: activityProv,
        showCollapseAll: false,
    });

    // ── Commands ─────────────────────────────────────────────
    const cmds = [
        vscode.commands.registerCommand('codepulse.showDashboard', () => {
            DashboardPanel.createOrShow(ctx, activityTracker, ca, da, dupa, cda, 'health');
        }),
        vscode.commands.registerCommand('codepulse.analyzeWorkspace', async () => {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'CodePulse: Analyzing workspace…', cancellable: false },
                async () => {
                    await analyzeWorkspace(ca, da, dupa, cda, diagManager);
                    healthProv.refresh();
                }
            );
            vscode.window.showInformationMessage('CodePulse: Analysis complete!');
        }),
        vscode.commands.registerCommand('codepulse.analyzeFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            await diagManager.analyzeDocument(editor.document, ca, da, dupa);
            healthProv.refresh();
            vscode.window.showInformationMessage(`CodePulse: Analyzed ${editor.document.fileName.split('/').pop()}`);
        }),
        vscode.commands.registerCommand('codepulse.showActivityReport', () => {
            DashboardPanel.createOrShow(ctx, activityTracker, ca, da, dupa, cda, 'activity');
        }),
        vscode.commands.registerCommand('codepulse.exportActivity', async () => {
            await activityTracker.exportReport();
        }),
        vscode.commands.registerCommand('codepulse.clearActivity', async () => {
            const pick = await vscode.window.showWarningMessage(
                'Clear all activity data for today? This cannot be undone.',
                { modal: true }, 'Clear'
            );
            if (pick === 'Clear') {
                activityTracker.clearData();
                activityProv.refresh();
                vscode.window.showInformationMessage('CodePulse: Activity data cleared.');
            }
        }),
        vscode.commands.registerCommand('codepulse.refreshHealth',   () => healthProv.refresh()),
        vscode.commands.registerCommand('codepulse.refreshActivity', () => activityProv.refresh()),
    ];

    // ── Events ───────────────────────────────────────────────
    const events = [
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            activityTracker.onFileSaved(doc);
            activityProv.refresh();
            if (SUPPORTED_RE.test(doc.fileName) && getConfig().autoAnalyzeOnSave) {
                await diagManager.analyzeDocument(doc, ca, da, dupa);
                healthProv.refresh();
            }
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                activityTracker.onEditorChanged(editor.document);
                activityProv.refresh();
            }
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            activityTracker.onDocumentChanged(event);
        }),
    ];

    // ── Status bar ───────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
    statusBar.command = 'codepulse.showDashboard';
    statusBar.tooltip = 'Open CodePulse Dashboard';

    const updateStatusBar = (): void => {
        const score = ca.getWorkspaceScore();
        const icon  = score >= 80 ? '$(pass-filled)' : score >= 50 ? '$(warning)' : '$(error)';
        statusBar.text = `${icon} CodePulse ${score}/100`;
        statusBar.show();
    };

    ctx.subscriptions.push(
        ...cmds, ...events,
        healthTree, activityTree,
        statusBar,
        { dispose: () => activityTracker.dispose() },
        { dispose: () => diagManager.dispose() },
    );

    // ── Startup analysis (delayed so VS Code finishes loading) ─
    setTimeout(async () => {
        await analyzeWorkspace(ca, da, dupa, cda, diagManager);
        healthProv.refresh();
        updateStatusBar();
    }, 4000);

    // Refresh status bar whenever health changes
    setInterval(updateStatusBar, 30000);

    vscode.window.setStatusBarMessage('$(pulse) CodePulse activated', 3000);
}

async function analyzeWorkspace(
    ca: ComplexityAnalyzer,
    da: DeadCodeAnalyzer,
    dupa: DuplicateAnalyzer,
    cda: CircularDepAnalyzer,
    dm: DiagnosticsManager
): Promise<void> {
    const cfg = getConfig();
    const excludeGlob = buildExcludeGlob(cfg.excludePatterns);
    const uris = await vscode.workspace.findFiles('**/*.{ts,tsx,js,jsx}', excludeGlob, 1000);

    // Circular dep analysis runs on file paths only (no TextDocument needed)
    cda.analyzeFiles(uris.map(u => u.fsPath));

    // Process files in batches to avoid freezing UI
    const BATCH = 10;
    for (let i = 0; i < uris.length; i += BATCH) {
        const batch = uris.slice(i, i + BATCH);
        await Promise.all(batch.map(async uri => {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await dm.analyzeDocument(doc, ca, da, dupa);
            } catch { /* skip unreadable */ }
        }));
    }
}

export function deactivate(): void {
    if (activityTracker) { activityTracker.dispose(); }
    if (diagManager)     { diagManager.dispose(); }
}
