import * as vscode from 'vscode';
import { ActivityTracker } from '../activity/activityTracker';
import { ComplexityAnalyzer } from '../analyzers/complexityAnalyzer';
import { DuplicateAnalyzer } from '../analyzers/duplicateAnalyzer';
import { CircularDepAnalyzer } from '../analyzers/circularDepAnalyzer';
import { DeadCodeAnalyzer } from '../analyzers/deadCodeAnalyzer';

export class DashboardPanel {
    private static instance: DashboardPanel | undefined;
    private readonly panel: vscode.WebviewPanel;

    static createOrShow(
        ctx:  vscode.ExtensionContext,
        at:   ActivityTracker,
        ca:   ComplexityAnalyzer,
        da:   DeadCodeAnalyzer,
        dupa: DuplicateAnalyzer,
        cda:  CircularDepAnalyzer,
        tab = 'health'
    ): void {
        if (DashboardPanel.instance) {
            DashboardPanel.instance.panel.reveal(vscode.ViewColumn.Two);
            DashboardPanel.instance.update(at, ca, da, dupa, cda, tab);
            return;
        }
        const panel = vscode.window.createWebviewPanel(
            'codepulseDashboard',
            '$(pulse) CodePulse',
            vscode.ViewColumn.Two,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        DashboardPanel.instance = new DashboardPanel(panel, at, ca, da, dupa, cda, tab);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        at:    ActivityTracker,
        ca:    ComplexityAnalyzer,
        da:    DeadCodeAnalyzer,
        dupa:  DuplicateAnalyzer,
        cda:   CircularDepAnalyzer,
        tab:   string
    ) {
        this.panel = panel;
        this.update(at, ca, da, dupa, cda, tab);
        panel.onDidDispose(() => { DashboardPanel.instance = undefined; });
        panel.webview.onDidReceiveMessage((msg: { command: string }) => {
            if (msg.command === 'analyzeWorkspace') {
                vscode.commands.executeCommand('codepulse.analyzeWorkspace');
            }
        });
    }

    update(at: ActivityTracker, ca: ComplexityAnalyzer, da: DeadCodeAnalyzer, dupa: DuplicateAnalyzer, cda: CircularDepAnalyzer, tab = 'health'): void {
        this.panel.webview.html = buildHtml({ at, ca, da, dupa, cda, tab });
    }
}

// ── HTML builder ──────────────────────────────────────────────────────────────

interface HtmlData {
    at:   ActivityTracker;
    ca:   ComplexityAnalyzer;
    da:   DeadCodeAnalyzer;
    dupa: DuplicateAnalyzer;
    cda:  CircularDepAnalyzer;
    tab:  string;
}

function esc(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildHtml({ at, ca, da, dupa, cda, tab }: HtmlData): string {
    const wsScore   = ca.getWorkspaceScore();
    const topFiles  = ca.getAllResults().sort((a, b) => a.overallScore - b.overallScore).slice(0, 15);
    const dups      = dupa.getAllDuplicates();
    const cycles    = cda.getCycles();
    const today     = at.getToday();
    const actFiles  = at.getTopFiles(10);
    const deadRs    = da.getAllResults().filter(r => r.items.length > 0).slice(0, 10);

    const sc = wsScore >= 80 ? '#00ff9d' : wsScore >= 50 ? '#ff9a3c' : '#ff4560';
    const critFiles = topFiles.filter(f => f.overallScore < 50).length;
    const fileCount = Object.keys(today.sessions).length;

    function tabClass(t: string) { return tab === t ? 'active' : ''; }

    const healthRows = topFiles.length ? topFiles.map(f => {
        const c = f.overallScore >= 80 ? '#00ff9d' : f.overallScore >= 50 ? '#ff9a3c' : '#ff4560';
        const bar = `<div class="bar" style="width:${f.overallScore}%;background:${c}"></div>`;
        const critFns = f.functions.filter(fn => fn.level === 'critical').length;
        return `<tr>
          <td title="${esc(f.filePath)}">${esc(f.fileName)}</td>
          <td><div class="bar-wrap">${bar}</div></td>
          <td style="color:${c};font-weight:600">${f.overallScore}</td>
          <td>${f.maxComplexity}</td>
          <td>${f.avgComplexity}</td>
          <td>${f.linesOfCode}</td>
          <td style="color:${critFns > 0 ? '#ff4560' : '#4a5568'}">${critFns}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="7" class="empty">Run <b>CodePulse: Analyze Workspace</b> to see results</td></tr>`;

    const deadRows = deadRs.length ? deadRs.map(r =>
        `<tr><td>${esc(r.fileName)}</td><td>${r.items.length}</td><td>${esc(r.items.slice(0,3).map(i => i.message).join('; '))}</td></tr>`
    ).join('') : `<tr><td colspan="3" class="empty">No dead code found — great job!</td></tr>`;

    const dupRows = dups.length ? dups.slice(0,10).map((d, i) =>
        `<tr>
          <td>#${i+1}</td>
          <td>${d.occurrences.length}</td>
          <td>${[...new Set(d.occurrences.map(o => esc(o.fileName)))].join(', ')}</td>
          <td class="snippet">${esc(d.snippet.substring(0, 60))}…</td>
        </tr>`
    ).join('') : `<tr><td colspan="4" class="empty">No duplicates found!</td></tr>`;

    const cycleRows = cycles.length ? cycles.slice(0,10).map((c, i) =>
        `<tr><td>#${i+1}</td><td>${c.cycle.map(esc).join(' <span class="arr">→</span> ')}</td></tr>`
    ).join('') : `<tr><td colspan="2" class="empty">No circular dependencies!</td></tr>`;

    const actRows = actFiles.length ? actFiles.map(f =>
        `<tr>
          <td title="${esc(f.filePath)}">${esc(f.fileName)}</td>
          <td>${at.formatTime(f.activeSeconds)}</td>
          <td style="color:#00ff9d">+${f.linesAdded}</td>
          <td style="color:#ff4560">-${f.linesDeleted}</td>
          <td>${f.editCount}</td>
          <td>${f.saveCount}</td>
          <td><span class="lang-badge">${esc(f.language)}</span></td>
        </tr>`
    ).join('') : `<tr><td colspan="7" class="empty">Start coding to see activity</td></tr>`;

    const langBreak = at.getLanguageBreakdown();
    const langBars = Object.entries(langBreak).sort((a,b) => b[1]-a[1]).slice(0,5).map(([lang, secs]) => {
        const total = today.totalActiveSeconds || 1;
        const pct = Math.round(secs / total * 100);
        return `<div class="lang-row"><span>${esc(lang)}</span><div class="lang-bar-wrap"><div class="lang-bar" style="width:${pct}%"></div></div><span>${at.formatTime(secs)}</span></div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>CodePulse</title>
<style>
:root{--bg:#0a0b0f;--panel:#111318;--border:#1e2130;--text:#c9d1e0;--dim:#4a5568;--green:#00ff9d;--blue:#3d8eff;--red:#ff4560;--orange:#ff9a3c;--purple:#b87fff}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;font-size:13px;padding:0;min-height:100vh}
.header{padding:20px 24px 0;border-bottom:1px solid var(--border);background:var(--panel)}
.title{font-size:20px;font-weight:700;letter-spacing:-0.5px;display:flex;align-items:center;gap:8px}
.title-sub{color:var(--dim);font-size:11px;font-family:monospace;margin-top:2px;margin-bottom:14px}
.tabs{display:flex;gap:0}
.tab{padding:10px 18px;cursor:pointer;font-size:12px;font-weight:600;border-bottom:2px solid transparent;color:var(--dim);transition:all .15s;letter-spacing:.5px;text-transform:uppercase}
.tab:hover{color:var(--text)}
.tab.active{color:var(--green);border-bottom-color:var(--green)}
.content{padding:20px 24px}
.tab-pane{display:none}.tab-pane.active{display:block}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:16px}
.card-val{font-size:30px;font-weight:700;font-family:monospace;margin-bottom:2px;line-height:1}
.card-label{color:var(--dim);font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
.section{margin-bottom:20px}
.section-title{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin-bottom:8px;font-weight:600}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--border);border-radius:6px;overflow:hidden}
th{padding:9px 12px;text-align:left;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--dim);background:#0d0e14;font-weight:600}
td{padding:8px 12px;border-top:1px solid var(--border);font-family:monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
tr:hover td{background:rgba(255,255,255,.02)}
.empty{text-align:center;color:var(--dim);padding:24px!important;font-family:system-ui}
.bar-wrap{width:80px;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.bar{height:100%;border-radius:3px;transition:width .3s}
.snippet{color:var(--dim);font-size:10px;max-width:300px}
.arr{color:var(--dim)}
.lang-row{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:12px;font-family:monospace}
.lang-row span:first-child{width:80px;color:var(--text)}
.lang-bar-wrap{flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.lang-bar{height:100%;background:var(--blue);border-radius:3px}
.lang-row span:last-child{width:50px;text-align:right;color:var(--dim)}
.lang-badge{background:rgba(61,142,255,.12);color:var(--blue);padding:2px 6px;border-radius:3px;font-size:10px}
.btn{background:var(--green);color:#0a0b0f;border:none;padding:8px 16px;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.5px}
.btn:hover{opacity:.85}
</style>
</head>
<body>
<div class="header">
  <div class="title">⚡ CodePulse</div>
  <div class="title-sub">// Codebase Health &amp; Activity Monitor</div>
  <div class="tabs">
    <div class="tab ${tabClass('health')}"   onclick="show('health')">🏥 Health</div>
    <div class="tab ${tabClass('activity')}" onclick="show('activity')">📊 Activity</div>
    <div class="tab ${tabClass('dead')}"     onclick="show('dead')">💀 Dead Code</div>
    <div class="tab ${tabClass('dup')}"      onclick="show('dup')">🔁 Duplicates</div>
    <div class="tab ${tabClass('circular')}" onclick="show('circular')">🔄 Circular Deps</div>
  </div>
</div>

<div class="content">

<!-- HEALTH -->
<div id="health" class="tab-pane ${tabClass('health')}">
  <div class="cards">
    <div class="card"><div class="card-val" style="color:${sc}">${wsScore}</div><div class="card-label">Health Score /100</div></div>
    <div class="card"><div class="card-val" style="color:var(--blue)">${topFiles.length}</div><div class="card-label">Files Analyzed</div></div>
    <div class="card"><div class="card-val" style="color:var(--red)">${critFiles}</div><div class="card-label">Critical Files</div></div>
    <div class="card"><div class="card-val" style="color:var(--orange)">${ca.getCriticalFunctions().length}</div><div class="card-label">Critical Functions</div></div>
  </div>
  <div class="section">
    <div class="section-title">File Complexity Report</div>
    <table>
      <thead><tr><th>File</th><th>Health</th><th>Score</th><th>Max CC</th><th>Avg CC</th><th>LOC</th><th>Critical Fns</th></tr></thead>
      <tbody>${healthRows}</tbody>
    </table>
  </div>
  <button class="btn" onclick="analyze()">▶ Analyze Workspace</button>
</div>

<!-- ACTIVITY -->
<div id="activity" class="tab-pane ${tabClass('activity')}">
  <div class="cards">
    <div class="card"><div class="card-val" style="color:var(--green)">${at.formatTime(today.totalActiveSeconds)}</div><div class="card-label">Active Today</div></div>
    <div class="card"><div class="card-val" style="color:var(--blue)">${fileCount}</div><div class="card-label">Files Touched</div></div>
    <div class="card"><div class="card-val" style="color:var(--purple)">+${at.getTotalLinesAdded()}</div><div class="card-label">Lines Written</div></div>
    <div class="card"><div class="card-val" style="color:var(--orange)">${actFiles.reduce((s,f)=>s+f.editCount,0)}</div><div class="card-label">Total Edits</div></div>
  </div>
  ${langBars ? `<div class="section"><div class="section-title">Language Breakdown</div>${langBars}</div>` : ''}
  <div class="section">
    <div class="section-title">File Activity</div>
    <table>
      <thead><tr><th>File</th><th>Time</th><th>+Lines</th><th>-Lines</th><th>Edits</th><th>Saves</th><th>Language</th></tr></thead>
      <tbody>${actRows}</tbody>
    </table>
  </div>
</div>

<!-- DEAD CODE -->
<div id="dead" class="tab-pane ${tabClass('dead')}">
  <div class="cards">
    <div class="card"><div class="card-val" style="color:var(--orange)">${da.getTotalDeadItems()}</div><div class="card-label">Total Issues</div></div>
    <div class="card"><div class="card-val" style="color:var(--blue)">${deadRs.length}</div><div class="card-label">Affected Files</div></div>
  </div>
  <div class="section">
    <div class="section-title">Dead Code by File</div>
    <table>
      <thead><tr><th>File</th><th>Issues</th><th>Messages</th></tr></thead>
      <tbody>${deadRows}</tbody>
    </table>
  </div>
</div>

<!-- DUPLICATES -->
<div id="dup" class="tab-pane ${tabClass('dup')}">
  <div class="cards">
    <div class="card"><div class="card-val" style="color:var(--orange)">${dups.length}</div><div class="card-label">Duplicate Blocks</div></div>
    <div class="card"><div class="card-val" style="color:var(--red)">${dups.reduce((s,d)=>s+d.occurrences.length,0)}</div><div class="card-label">Total Occurrences</div></div>
    <div class="card"><div class="card-val" style="color:var(--blue)">${dupa.getAffectedFiles()}</div><div class="card-label">Affected Files</div></div>
  </div>
  <div class="section">
    <div class="section-title">Duplicate Blocks</div>
    <table>
      <thead><tr><th>#</th><th>Count</th><th>Files</th><th>Preview</th></tr></thead>
      <tbody>${dupRows}</tbody>
    </table>
  </div>
</div>

<!-- CIRCULAR DEPS -->
<div id="circular" class="tab-pane ${tabClass('circular')}">
  <div class="cards">
    <div class="card"><div class="card-val" style="color:${cycles.length ? 'var(--red)' : 'var(--green)'}">${cycles.length}</div><div class="card-label">Circular Cycles</div></div>
  </div>
  <div class="section">
    <div class="section-title">Dependency Cycles</div>
    <table>
      <thead><tr><th>#</th><th>Cycle Chain</th></tr></thead>
      <tbody>${cycleRows}</tbody>
    </table>
  </div>
</div>

</div><!-- .content -->

<script>
function show(t) {
    document.querySelectorAll('.tab,.tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById(t).classList.add('active');
    const tabs = document.querySelectorAll('.tab');
    const idx = ['health','activity','dead','dup','circular'].indexOf(t);
    if (idx >= 0) { tabs[idx].classList.add('active'); }
}
function analyze() {
    const vscode = acquireVsCodeApi();
    vscode.postMessage({ command: 'analyzeWorkspace' });
}
</script>
</body>
</html>`;
}
