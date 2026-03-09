import * as vscode from 'vscode';
import { ComplexityAnalyzer } from '../analyzers/complexityAnalyzer';
import { DeadCodeAnalyzer } from '../analyzers/deadCodeAnalyzer';
import { DuplicateAnalyzer } from '../analyzers/duplicateAnalyzer';
import { CircularDepAnalyzer } from '../analyzers/circularDepAnalyzer';

type NodeType = 'root-complexity' | 'root-dead' | 'root-dup' | 'root-circular' | 'leaf';

class HealthNode extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly nodeType: NodeType,
        state   = vscode.TreeItemCollapsibleState.None,
        desc?:   string,
        tip?:    string,
        icon?:   string
    ) {
        super(label, state);
        this.description = desc;
        this.tooltip     = tip ?? label;
        if (icon) { this.iconPath = new vscode.ThemeIcon(icon); }
    }
}

export class HealthTreeProvider implements vscode.TreeDataProvider<HealthNode> {
    private readonly _evt = new vscode.EventEmitter<HealthNode | undefined>();
    readonly onDidChangeTreeData = this._evt.event;

    constructor(
        private readonly ca:   ComplexityAnalyzer,
        private readonly da:   DeadCodeAnalyzer,
        private readonly dupa: DuplicateAnalyzer,
        private readonly cda:  CircularDepAnalyzer
    ) {}

    refresh(): void { this._evt.fire(undefined); }
    getTreeItem(n: HealthNode): HealthNode { return n; }

    getChildren(node?: HealthNode): HealthNode[] {
        if (!node) { return this.roots(); }
        switch (node.nodeType) {
            case 'root-complexity': return this.complexityChildren();
            case 'root-dead':      return this.deadChildren();
            case 'root-dup':       return this.dupChildren();
            case 'root-circular':  return this.circularChildren();
            default:               return [];
        }
    }

    private roots(): HealthNode[] {
        const score    = this.ca.getWorkspaceScore();
        const dead     = this.da.getTotalDeadItems();
        const dups     = this.dupa.getTotalDuplicates();
        const cycles   = this.cda.getCycles().length;
        const scoreIcon = score >= 80 ? 'pass-filled' : score >= 50 ? 'warning' : 'error';

        return [
            new HealthNode('Complexity',        'root-complexity', vscode.TreeItemCollapsibleState.Expanded,
                `Score: ${score}/100`, `Overall workspace health score: ${score}/100`, scoreIcon),
            new HealthNode('Dead Code',          'root-dead',       vscode.TreeItemCollapsibleState.Collapsed,
                `${dead} issues`, `${dead} unused code items found`, dead === 0 ? 'pass-filled' : 'warning'),
            new HealthNode('Duplicates',         'root-dup',        vscode.TreeItemCollapsibleState.Collapsed,
                `${dups} blocks`, `${dups} duplicate code blocks`, dups === 0 ? 'pass-filled' : 'warning'),
            new HealthNode('Circular Deps',      'root-circular',   vscode.TreeItemCollapsibleState.Collapsed,
                `${cycles} cycles`, cycles === 0 ? 'No circular dependencies found' : `${cycles} circular dependency cycles`, cycles === 0 ? 'pass-filled' : 'error'),
        ];
    }

    private complexityChildren(): HealthNode[] {
        const rs = this.ca.getAllResults().sort((a, b) => a.overallScore - b.overallScore).slice(0, 15);
        if (!rs.length) {
            return [new HealthNode('Run "Analyze Workspace" to start', 'leaf', vscode.TreeItemCollapsibleState.None, undefined, undefined, 'info')];
        }
        return rs.map(r => {
            const icon = r.overallScore >= 80 ? 'pass-filled' : r.overallScore >= 50 ? 'warning' : 'error';
            const tip  = [
                `File: ${r.filePath}`,
                `Score: ${r.overallScore}/100`,
                `Max Complexity: ${r.maxComplexity}`,
                `Avg Complexity: ${r.avgComplexity}`,
                `Functions: ${r.functions.length}`,
                `Lines of Code: ${r.linesOfCode}`,
                r.functions.filter(f => f.level === 'critical').length > 0
                    ? `Critical functions: ${r.functions.filter(f => f.level === 'critical').map(f => f.name).join(', ')}`
                    : ''
            ].filter(Boolean).join('\n');
            return new HealthNode(r.fileName, 'leaf', vscode.TreeItemCollapsibleState.None,
                `${r.overallScore}/100  max:${r.maxComplexity}`, tip, icon);
        });
    }

    private deadChildren(): HealthNode[] {
        const rs = this.da.getAllResults().filter(r => r.items.length > 0).slice(0, 15);
        if (!rs.length) {
            return [new HealthNode('No dead code found!', 'leaf', vscode.TreeItemCollapsibleState.None, undefined, undefined, 'pass-filled')];
        }
        return rs.map(r => new HealthNode(
            r.fileName, 'leaf', vscode.TreeItemCollapsibleState.None,
            `${r.items.length} issues`,
            r.items.slice(0, 10).map(i => `• ${i.message}`).join('\n'),
            'warning'
        ));
    }

    private dupChildren(): HealthNode[] {
        const ds = this.dupa.getAllDuplicates().slice(0, 10);
        if (!ds.length) {
            return [new HealthNode('No duplicates found!', 'leaf', vscode.TreeItemCollapsibleState.None, undefined, undefined, 'pass-filled')];
        }
        return ds.map((d, i) => {
            const files = [...new Set(d.occurrences.map(o => o.fileName))].join(', ');
            return new HealthNode(
                `Block #${i + 1}`,
                'leaf',
                vscode.TreeItemCollapsibleState.None,
                `${d.occurrences.length}x in ${files}`,
                `Duplicate block (${d.blockLines} lines, ${d.occurrences.length} occurrences)\n${d.occurrences.map(o => `${o.fileName}:${o.startLine}`).join('\n')}`,
                'copy'
            );
        });
    }

    private circularChildren(): HealthNode[] {
        const cs = this.cda.getCycles().slice(0, 10);
        if (!cs.length) {
            return [new HealthNode('No circular dependencies!', 'leaf', vscode.TreeItemCollapsibleState.None, undefined, undefined, 'pass-filled')];
        }
        return cs.map((c, i) => new HealthNode(
            `Cycle #${i + 1}: ${c.cycle.join(' → ')}`,
            'leaf',
            vscode.TreeItemCollapsibleState.None,
            `${c.cycle.length} files`,
            c.cycle.join(' → '),
            'error'
        ));
    }
}
