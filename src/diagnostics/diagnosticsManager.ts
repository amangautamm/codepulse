import * as vscode from 'vscode';
import { ComplexityAnalyzer } from '../analyzers/complexityAnalyzer';
import { DeadCodeAnalyzer } from '../analyzers/deadCodeAnalyzer';
import { DuplicateAnalyzer } from '../analyzers/duplicateAnalyzer';

const SUPPORTED = /\.(ts|tsx|js|jsx)$/;

export class DiagnosticsManager {
    private readonly complexityDC: vscode.DiagnosticCollection;
    private readonly deadCodeDC: vscode.DiagnosticCollection;
    private readonly duplicateDC: vscode.DiagnosticCollection;

    constructor(_ctx: vscode.ExtensionContext) {
        this.complexityDC = vscode.languages.createDiagnosticCollection('codepulse-complexity');
        this.deadCodeDC   = vscode.languages.createDiagnosticCollection('codepulse-dead');
        this.duplicateDC  = vscode.languages.createDiagnosticCollection('codepulse-dup');
    }

    async analyzeDocument(
        doc: vscode.TextDocument,
        ca: ComplexityAnalyzer,
        da: DeadCodeAnalyzer,
        dupa: DuplicateAnalyzer
    ): Promise<void> {
        if (!SUPPORTED.test(doc.fileName)) { return; }

        // — Complexity —
        const cr = ca.analyze(doc);
        const cDiags: vscode.Diagnostic[] = cr.functions
            .filter(f => f.level !== 'healthy')
            .map(f => {
                const lineIdx = Math.min(f.line - 1, doc.lineCount - 1);
                const textLine = doc.lineAt(lineIdx);
                const range = new vscode.Range(
                    new vscode.Position(lineIdx, textLine.firstNonWhitespaceCharacterIndex),
                    new vscode.Position(lineIdx, textLine.text.length)
                );
                const sev = f.level === 'critical'
                    ? vscode.DiagnosticSeverity.Warning
                    : vscode.DiagnosticSeverity.Information;
                const d = new vscode.Diagnostic(range,
                    `[CodePulse] '${f.name}' complexity: ${f.complexity} (${f.level}) — consider refactoring`,
                    sev);
                d.source = 'CodePulse';
                d.code = { value: 'complexity', target: vscode.Uri.parse('https://en.wikipedia.org/wiki/Cyclomatic_complexity') };
                return d;
            });
        this.complexityDC.set(doc.uri, cDiags);

        // — Dead code —
        const dr = da.analyze(doc);
        const dDiags: vscode.Diagnostic[] = dr.items.map(item => {
            const lineIdx = Math.min(item.line - 1, doc.lineCount - 1);
            const textLine = doc.lineAt(lineIdx);
            const range = new vscode.Range(
                new vscode.Position(lineIdx, textLine.firstNonWhitespaceCharacterIndex),
                new vscode.Position(lineIdx, textLine.text.length)
            );
            const d = new vscode.Diagnostic(range,
                `[CodePulse] ${item.message}`,
                vscode.DiagnosticSeverity.Hint);
            d.source = 'CodePulse';
            d.code = 'dead-code';
            d.tags = [vscode.DiagnosticTag.Unnecessary];
            return d;
        });
        this.deadCodeDC.set(doc.uri, dDiags);

        // — Duplicates —
        const dups = dupa.analyze(doc);
        const dupDiags: vscode.Diagnostic[] = [];
        for (const dup of dups) {
            for (const occ of dup.occurrences) {
                if (occ.filePath !== doc.fileName) { continue; }
                const startIdx = Math.min(occ.startLine - 1, doc.lineCount - 1);
                const endIdx   = Math.min(occ.endLine   - 1, doc.lineCount - 1);
                const range = new vscode.Range(
                    new vscode.Position(startIdx, 0),
                    new vscode.Position(endIdx, doc.lineAt(endIdx).text.length)
                );
                const d = new vscode.Diagnostic(range,
                    `[CodePulse] Duplicate code block (${dup.occurrences.length} occurrences). Preview: ${dup.snippet.substring(0, 60)}…`,
                    vscode.DiagnosticSeverity.Information);
                d.source = 'CodePulse';
                d.code = 'duplicate';
                dupDiags.push(d);
            }
        }
        this.duplicateDC.set(doc.uri, dupDiags);
    }

    clearAll(): void {
        this.complexityDC.clear();
        this.deadCodeDC.clear();
        this.duplicateDC.clear();
    }

    dispose(): void {
        this.complexityDC.dispose();
        this.deadCodeDC.dispose();
        this.duplicateDC.dispose();
    }
}
