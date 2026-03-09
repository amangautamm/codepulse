import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig } from '../utils/config';

export type DeadItemType = 'import' | 'variable' | 'function';

export interface DeadCodeItem {
    type: DeadItemType;
    name: string;
    line: number;   // 1-based
    message: string;
}

export interface DeadCodeResult {
    filePath: string;
    fileName: string;
    items: DeadCodeItem[];
}

// Strip comments from source before analysis
function stripComments(text: string): string {
    // Remove single-line comments
    let out = text.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    out = out.replace(/\/\*[\s\S]*?\*\//g, '');
    return out;
}

export class DeadCodeAnalyzer {
    private readonly results = new Map<string, DeadCodeResult>();

    analyze(document: vscode.TextDocument): DeadCodeResult {
        const cfg = getConfig();
        if (!cfg.enableDeadCodeDetection) {
            return { filePath: document.fileName, fileName: path.basename(document.fileName), items: [] };
        }

        const rawText = document.getText();
        const cleanText = stripComments(rawText);
        const lines = rawText.split('\n');
        const items: DeadCodeItem[] = [
            ...this.detectUnusedImports(lines, cleanText),
            ...this.detectUnusedVariables(lines, cleanText),
            ...this.detectUnusedTopLevelFunctions(lines, cleanText),
        ];
        // Dedupe by line
        const seen = new Set<number>();
        const deduped = items.filter(i => { if (seen.has(i.line)) { return false; } seen.add(i.line); return true; });

        const result: DeadCodeResult = {
            filePath: document.fileName,
            fileName: path.basename(document.fileName),
            items: deduped,
        };
        this.results.set(document.fileName, result);
        return result;
    }

    private detectUnusedImports(lines: string[], cleanText: string): DeadCodeItem[] {
        const items: DeadCodeItem[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Named imports: import { A, B as C } from '...'
            const namedMatch = line.match(/^import\s*\{([^}]+)\}\s*from/);
            if (namedMatch) {
                const names = namedMatch[1].split(',').map(n => {
                    const parts = n.trim().split(/\s+as\s+/);
                    return parts[parts.length - 1].trim();
                }).filter(n => /^\w+$/.test(n));
                for (const name of names) {
                    if (this.countUsages(cleanText, name, i) === 0) {
                        items.push({ type: 'import', name, line: i + 1, message: `Imported '${name}' is never used` });
                    }
                }
                continue;
            }
            // Default import: import Foo from '...'
            const defMatch = line.match(/^import\s+(\w+)\s+from/);
            if (defMatch) {
                const name = defMatch[1];
                if (name && this.countUsages(cleanText, name, i) === 0) {
                    items.push({ type: 'import', name, line: i + 1, message: `Imported '${name}' is never used` });
                }
                continue;
            }
            // Namespace import: import * as Foo from '...'
            const nsMatch = line.match(/^import\s+\*\s+as\s+(\w+)\s+from/);
            if (nsMatch) {
                const name = nsMatch[1];
                if (name && this.countUsages(cleanText, name, i) === 0) {
                    items.push({ type: 'import', name, line: i + 1, message: `Namespace import '${name}' is never used` });
                }
            }
        }
        return items;
    }

    private detectUnusedVariables(lines: string[], cleanText: string): DeadCodeItem[] {
        const items: DeadCodeItem[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const m = line.match(/^\s*(?:const|let|var)\s+(\w+)\s*(?:[:=])/);
            if (!m || !m[1]) { continue; }
            const name = m[1];
            if (name.startsWith('_') || name === 'exports') { continue; }
            if (this.countUsages(cleanText, name, i) === 0) {
                items.push({ type: 'variable', name, line: i + 1, message: `'${name}' is declared but never used` });
            }
        }
        return items;
    }

    private detectUnusedTopLevelFunctions(lines: string[], cleanText: string): DeadCodeItem[] {
        const items: DeadCodeItem[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Only top-level non-exported functions
            const m = line.match(/^function\s+(\w+)\s*\(/);
            if (!m || !m[1]) { continue; }
            const name = m[1];
            if (name.startsWith('_')) { continue; }
            if (this.countUsages(cleanText, name, i) === 0) {
                items.push({ type: 'function', name, line: i + 1, message: `Function '${name}' is defined but never called` });
            }
        }
        return items;
    }

    /** Count how many times `name` appears as a word AFTER its definition line */
    private countUsages(text: string, name: string, defLine: number): number {
        const textAfterDef = text.split('\n').slice(defLine + 1).join('\n');
        const re = new RegExp(`\\b${name}\\b`, 'g');
        return (textAfterDef.match(re) || []).length;
    }

    getResult(fp: string): DeadCodeResult | undefined          { return this.results.get(fp); }
    getAllResults(): DeadCodeResult[]                           { return [...this.results.values()]; }
    getTotalDeadItems(): number {
        return [...this.results.values()].reduce((s, r) => s + r.items.length, 0);
    }
}
