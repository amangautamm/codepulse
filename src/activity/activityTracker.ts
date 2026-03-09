import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../utils/config';

export interface FileSession {
    filePath: string;
    fileName: string;
    language: string;
    firstOpenedAt: number;
    activeSeconds: number;
    linesAdded: number;
    linesDeleted: number;
    saveCount: number;
    editCount: number;
}

export interface DayActivity {
    date: string;
    totalActiveSeconds: number;
    sessionStart: number;
    sessions: Record<string, FileSession>;
}

const STORAGE_PREFIX = 'codepulse_activity_';
const SAVE_INTERVAL_MS = 20000;
const PERSIST_DAYS = 30;

export class ActivityTracker {
    private today: DayActivity;
    private currentFile: string | null = null;
    private lastActivityAt = Date.now();
    private idleHandle: ReturnType<typeof setTimeout> | null = null;
    private saveHandle: ReturnType<typeof setInterval>;
    private prevLineCounts = new Map<string, number>();

    constructor(private readonly ctx: vscode.ExtensionContext) {
        this.today = this.load();
        this.saveHandle = setInterval(() => this.persist(), SAVE_INTERVAL_MS);
        this.pruneOldData();
    }

    // ── event hooks ──────────────────────────────────────────

    onEditorChanged(doc: vscode.TextDocument): void {
        this.flushElapsed();
        this.currentFile = doc.fileName;
        if (!this.today.sessions[doc.fileName]) {
            this.today.sessions[doc.fileName] = {
                filePath: doc.fileName,
                fileName: path.basename(doc.fileName),
                language: doc.languageId,
                firstOpenedAt: Date.now(),
                activeSeconds: 0,
                linesAdded: 0, linesDeleted: 0,
                saveCount: 0, editCount: 0,
            };
        }
        this.prevLineCounts.set(doc.fileName, doc.lineCount);
        this.resetIdle();
    }

    onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        const doc = event.document;
        const prev = this.prevLineCounts.get(doc.fileName) ?? doc.lineCount;
        const diff = doc.lineCount - prev;
        const s = this.today.sessions[doc.fileName];
        if (s) {
            s.editCount++;
            if (diff > 0) { s.linesAdded   += diff; }
            else          { s.linesDeleted  += Math.abs(diff); }
        }
        this.prevLineCounts.set(doc.fileName, doc.lineCount);
        this.flushElapsed();
        this.resetIdle();
    }

    onFileSaved(doc: vscode.TextDocument): void {
        const s = this.today.sessions[doc.fileName];
        if (s) { s.saveCount++; }
        this.persist();
    }

    // ── public API ───────────────────────────────────────────

    getToday(): DayActivity { return this.today; }

    getTopFiles(limit = 8): FileSession[] {
        return Object.values(this.today.sessions)
            .sort((a, b) => b.activeSeconds - a.activeSeconds)
            .slice(0, limit);
    }

    getTotalLinesAdded(): number {
        return Object.values(this.today.sessions).reduce((s, f) => s + f.linesAdded, 0);
    }

    getLanguageBreakdown(): Record<string, number> {
        const out: Record<string, number> = {};
        for (const s of Object.values(this.today.sessions)) {
            out[s.language] = (out[s.language] ?? 0) + s.activeSeconds;
        }
        return out;
    }

    formatTime(secs: number): string {
        if (secs < 60)   { return `${secs}s`; }
        if (secs < 3600) { return `${Math.floor(secs / 60)}m`; }
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }

    async exportReport(): Promise<void> {
        const summary = this.getToday();
        const files = this.getTopFiles(50);
        const dateStr = new Date(summary.sessionStart).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const langBreak = this.getLanguageBreakdown();

        let md = `# CodePulse Activity Report\n\n`;
        md += `**Date:** ${dateStr}\n`;
        md += `**Total Active Coding Time:** ${this.formatTime(summary.totalActiveSeconds)}\n`;
        md += `**Files Worked On:** ${Object.keys(summary.sessions).length}\n`;
        md += `**Total Lines Written:** ${this.getTotalLinesAdded()}\n\n`;

        if (Object.keys(langBreak).length) {
            md += `## Language Breakdown\n\n`;
            md += `| Language | Time |\n|----------|------|\n`;
            for (const [lang, secs] of Object.entries(langBreak).sort((a, b) => b[1] - a[1])) {
                md += `| ${lang} | ${this.formatTime(secs)} |\n`;
            }
            md += '\n';
        }

        md += `## File Breakdown\n\n`;
        md += `| File | Time | +Lines | -Lines | Edits | Saves |\n`;
        md += `|------|------|--------|--------|-------|-------|\n`;
        for (const f of files) {
            md += `| ${f.fileName} | ${this.formatTime(f.activeSeconds)} | +${f.linesAdded} | -${f.linesDeleted} | ${f.editCount} | ${f.saveCount} |\n`;
        }

        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`codepulse-${summary.date}.md`),
            filters: { 'Markdown': ['md'], 'Text': ['txt'] },
        });
        if (uri) {
            fs.writeFileSync(uri.fsPath, md, 'utf8');
            vscode.window.showInformationMessage(`CodePulse: Report saved → ${path.basename(uri.fsPath)}`);
        }
    }

    clearData(): void {
        this.ctx.globalState.update(STORAGE_PREFIX + this.today.date, undefined);
        this.today = this.load();
    }

    dispose(): void {
        this.persist();
        if (this.idleHandle) { clearTimeout(this.idleHandle); }
        clearInterval(this.saveHandle);
    }

    // ── private helpers ──────────────────────────────────────

    private flushElapsed(): void {
        const cfg = getConfig();
        const now = Date.now();
        const idleMs = cfg.activityIdleTimeoutMinutes * 60 * 1000;
        const elapsed = now - this.lastActivityAt;
        if (elapsed < idleMs && elapsed > 0) {
            const secs = Math.floor(elapsed / 1000);
            this.today.totalActiveSeconds += secs;
            if (this.currentFile) {
                const s = this.today.sessions[this.currentFile];
                if (s) { s.activeSeconds += secs; }
            }
        }
        this.lastActivityAt = now;
    }

    private resetIdle(): void {
        if (this.idleHandle) { clearTimeout(this.idleHandle); }
        const cfg = getConfig();
        this.idleHandle = setTimeout(() => { this.lastActivityAt = Date.now(); }, cfg.activityIdleTimeoutMinutes * 60 * 1000);
    }

    private persist(): void {
        this.ctx.globalState.update(STORAGE_PREFIX + this.today.date, this.today);
    }

    private load(): DayActivity {
        const date = new Date().toISOString().split('T')[0];
        const stored = this.ctx.globalState.get<DayActivity>(STORAGE_PREFIX + date);
        return stored ?? { date, totalActiveSeconds: 0, sessionStart: Date.now(), sessions: {} };
    }

    private pruneOldData(): void {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - PERSIST_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const keys = this.ctx.globalState.keys();
        for (const k of keys) {
            if (k.startsWith(STORAGE_PREFIX)) {
                const dateStr = k.replace(STORAGE_PREFIX, '');
                if (dateStr < cutoffStr) {
                    this.ctx.globalState.update(k, undefined);
                }
            }
        }
    }
}
