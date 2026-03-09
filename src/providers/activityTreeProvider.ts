import * as vscode from 'vscode';
import { ActivityTracker } from '../activity/activityTracker';

class ActivityNode extends vscode.TreeItem {
    constructor(label: string, desc?: string, tip?: string, icon?: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = desc;
        this.tooltip     = tip ?? label;
        if (icon) { this.iconPath = new vscode.ThemeIcon(icon); }
    }
}

export class ActivityTreeProvider implements vscode.TreeDataProvider<ActivityNode> {
    private readonly _evt = new vscode.EventEmitter<ActivityNode | undefined>();
    readonly onDidChangeTreeData = this._evt.event;

    constructor(private readonly tracker: ActivityTracker) {}

    refresh():                    void        { this._evt.fire(undefined); }
    getTreeItem(n: ActivityNode): ActivityNode { return n; }

    getChildren(): ActivityNode[] {
        const today    = this.tracker.getToday();
        const files    = this.tracker.getTopFiles(10);
        const fileCount= Object.keys(today.sessions).length;
        const langBreak= this.tracker.getLanguageBreakdown();
        const topLang  = Object.entries(langBreak).sort((a, b) => b[1] - a[1]).slice(0, 3);

        const nodes: ActivityNode[] = [
            new ActivityNode('Active Time',    this.tracker.formatTime(today.totalActiveSeconds), 'Total active coding time today', 'clock'),
            new ActivityNode('Files Touched',  `${fileCount}`,         'Number of distinct files worked on', 'files'),
            new ActivityNode('Lines Written',  `+${this.tracker.getTotalLinesAdded()}`, 'Total lines added today', 'edit'),
        ];

        if (topLang.length) {
            nodes.push(new ActivityNode('── Languages ──'));
            for (const [lang, secs] of topLang) {
                nodes.push(new ActivityNode(lang, this.tracker.formatTime(secs), `Time spent in ${lang}`, 'symbol-keyword'));
            }
        }

        if (files.length) {
            nodes.push(new ActivityNode('── Top Files ──'));
            for (const f of files) {
                const tip = [
                    `File: ${f.filePath}`,
                    `Active: ${this.tracker.formatTime(f.activeSeconds)}`,
                    `+${f.linesAdded} lines added`,
                    `-${f.linesDeleted} lines deleted`,
                    `${f.editCount} edits, ${f.saveCount} saves`,
                ].join('\n');
                nodes.push(new ActivityNode(f.fileName, this.tracker.formatTime(f.activeSeconds), tip, 'file-code'));
            }
        }

        return nodes;
    }
}
